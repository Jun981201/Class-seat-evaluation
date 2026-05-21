// ── Helpers ──
function $(id) { return document.getElementById(id); }

function toast(msg, type) {
    var el = $('toast');
    el.textContent = msg;
    el.className = 'toast show ' + (type || '');
    setTimeout(function() { el.classList.remove('show'); }, 2500);
}

function setLoading(el, text) {
    el.innerHTML = text;
    el.className = 'upload-status loading';
}
function setOK(el, text) {
    el.innerHTML = text;
    el.className = 'upload-status success';
}
function setErr(el, text) {
    el.innerHTML = text;
    el.className = 'upload-status error';
}

// ── Drag & Drop ──
function setupDragDrop(uploadArea, fileInput) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(function(evt) {
        uploadArea.addEventListener(evt, function(e) { e.preventDefault(); e.stopPropagation(); });
    });

    uploadArea.addEventListener('dragenter', function() { uploadArea.classList.add('dragover'); });
    uploadArea.addEventListener('dragover', function() { uploadArea.classList.add('dragover'); });
    uploadArea.addEventListener('dragleave', function(e) {
        if (!uploadArea.contains(e.relatedTarget)) uploadArea.classList.remove('dragover');
    });
    uploadArea.addEventListener('drop', function(e) {
        uploadArea.classList.remove('dragover');
        var files = e.dataTransfer.files;
        if (files.length) {
            // Create a new DataTransfer to set the file to the input
            var dt = new DataTransfer();
            dt.items.add(files[0]);
            fileInput.files = dt.files;
            fileInput.dispatchEvent(new Event('change'));
        }
    });
}

// ── State ──
var dataA = null;     // parsed student list
var studentsA = [];   // filtered students
var dataB = null;     // grades/comments result
var templatesList = [];  // available evaluation templates

// Load templates on page load
function loadTemplates() {
    fetch('/api/list-templates')
    .then(function(r) { return r.json(); })
    .then(function(templates) {
        templatesList = templates;
        var sel = $('template-select-a');
        sel.innerHTML = '';
        for (var i = 0; i < templates.length; i++) {
            var t = templates[i];
            sel.innerHTML += '<option value="' + t.id + '">' + t.name + '</option>';
        }
    });
}
loadTemplates();

// ── Template state ──
var previewConfig = null;   // parsed but not saved
var previewFilePath = null; // temp file path for save
var editingExisting = false; // editing existing vs new

// ── Template file upload → preview ──
$('template-file').addEventListener('change', function() {
    var file = this.files[0];
    if (!file) return;
    var status = $('template-upload-status');
    setLoading(status, '解析模板中...');

    var fd = new FormData();
    fd.append('file', file);
    fd.append('action', 'preview');
    fetch('/api/upload-template', { method: 'POST', body: fd })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.error) { setErr(status, data.error); return; }
        setOK(status, '模板已解析，请确认后保存');
        editingExisting = false;
        showTemplatePreview(data.template);
    })
    .catch(function() { setErr(status, '网络错误'); });
});

// ── Edit existing template ──
function editTemplate() {
    var tid = $('template-select-a').value;
    if (!tid) { toast('请先选择一个模板', 'error'); return; }

    fetch('/api/list-templates-full')
    .then(function(r) { return r.json(); })
    .then(function(templates) {
        for (var i = 0; i < templates.length; i++) {
            if (templates[i].id === tid) {
                editingExisting = true;
                previewConfig = null;
                previewFilePath = '';
                showTemplatePreview(templates[i]);
                toast('编辑后点击"确认保存"即可更新模板', '');
                return;
            }
        }
        toast('模板未找到', 'error');
    })
    .catch(function() { toast('加载模板详情失败', 'error'); });
}

// ── Show template preview panel ──
function showTemplatePreview(config) {
    previewConfig = config;
    previewFilePath = config._preview_file || '';
    $('template-preview').style.display = 'block';
    $('tpl-edit-name').value = config.name || '';
    $('tpl-edit-title').value = config.title || '';

    // Render columns table with editable fields
    var cols = config.columns || [];
    var html = '<table style=\"width:100%;border-collapse:collapse;\"><thead><tr>' +
        '<th>列名</th><th>列宽</th><th>教师</th><th>规则</th></tr></thead><tbody>';
    for (var i = 0; i < cols.length; i++) {
        var c = cols[i];
        html += '<tr>' +
            '<td><input value=\"' + esc(c.header) + '\" data-idx=\"' + i + '\" data-field=\"header\" style=\"width:100%;\"></td>' +
            '<td><input value=\"' + c.width + '\" data-idx=\"' + i + '\" data-field=\"width\" style=\"width:60px;\"></td>' +
            '<td><input value=\"' + esc(c.teacher || '') + '\" data-idx=\"' + i + '\" data-field=\"teacher\" style=\"width:100%;\"></td>' +
            '<td><input value=\"' + esc(c.rule || '') + '\" data-idx=\"' + i + '\" data-field=\"rule\" style=\"width:100%;\"></td>' +
            '</tr>';
    }
    html += '</tbody></table>';
    $('tpl-columns-preview').innerHTML = html;

    // Group section info
    var gs = config.group_section;
    if (gs && gs.groups) {
        var ghtml = '<label style="font-size:13px;color:#475569;">小组评分 (' + gs.num_groups + '组)</label><div class="template-group-tags">';
        for (var j = 0; j < gs.groups.length; j++) {
            ghtml += '<span class="template-group-tag">' +
                esc(gs.groups[j].header) + ' <small>' + esc(gs.groups[j].rule || '') + '</small></span>';
        }
        ghtml += '</div>';
        $('tpl-group-preview').innerHTML = ghtml;
    } else {
        $('tpl-group-preview').innerHTML = '<span style=\"color:#94a3b8;\">无小组评分区域</span>';
    }

    $('template-preview').scrollIntoView({ behavior: 'smooth' });
}

function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;');
}

// ── Collect edited config from preview ──
function collectConfig() {
    if (!previewConfig) return null;
    var config = JSON.parse(JSON.stringify(previewConfig)); // deep clone
    config.name = $('tpl-edit-name').value.trim();
    config.title = $('tpl-edit-title').value.trim();

    // Collect column edits
    var inputs = document.querySelectorAll('#tpl-columns-preview input');
    for (var i = 0; i < inputs.length; i++) {
        var inp = inputs[i];
        var idx = parseInt(inp.dataset.idx);
        var field = inp.dataset.field;
        if (idx >= 0 && idx < config.columns.length) {
            if (field === 'width') {
                config.columns[idx][field] = parseFloat(inp.value) || 8;
            } else {
                config.columns[idx][field] = inp.value;
            }
        }
    }
    return config;
}

// ── Save template ──
function saveTemplate() {
    var config = collectConfig();
    if (!config || !config.name) { toast('请填写模板名称', 'error'); return; }

    var status = $('template-upload-status');
    setLoading(status, '保存模板中...');

    var url, body;
    if (editingExisting && !previewFilePath) {
        // Edit existing — no new file
        url = '/api/update-template';
        body = JSON.stringify({ config: config });
    } else {
        // New upload, or edit with file
        url = '/api/upload-template';
        body = JSON.stringify({
            action: 'save',
            config: config,
            preview_file: previewFilePath,
        });
    }

    fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.error) { setErr(status, data.error); return; }
        setOK(status, data.message);
        $('template-preview').style.display = 'none';
        previewConfig = null;
        previewFilePath = null;
        editingExisting = false;
        loadTemplates();
        // Select the saved template
        setTimeout(function() {
            $('template-select-a').value = data.template ? data.template.id : config.id;
        }, 200);
    })
    .catch(function() { setErr(status, '网络错误'); });
}

// ── Cancel template preview ──
function cancelTemplate() {
    $('template-preview').style.display = 'none';
    previewConfig = null;
    previewFilePath = null;
    $('template-upload-status').innerHTML = '';
}

// ── Delete template ──
function deleteTemplate() {
    var tid = $('template-select-a').value;
    if (!tid) { toast('请先选择一个模板', 'error'); return; }
    var name = $('template-select-a').selectedOptions[0].textContent;
    if (!confirm('确定要删除模板 "' + name + '" 吗？此操作不可撤销。')) return;

    fetch('/api/delete-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tid }),
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.error) { toast(data.error, 'error'); return; }
        toast(data.message, 'success');
        loadTemplates();
    })
    .catch(function() { toast('网络错误', 'error'); });
}

function extractSchool(filename) {
    // Extract school name from filename.
    // "第X周" means "Week X" — school name precedes grade level.
    // e.g. "25学年第二学期第12周比乐高一学生名单.xls" -> "比乐中学"
    // e.g. "比乐中学高一学生名单.xls"                -> "比乐中学"
    // e.g. "比乐高一学生名单.xls"                    -> "比乐中学"

    // Pattern 1: SCHOOL中学/初中/小学 before 高一 (full name already in filename)
    var m = filename.match(/([一-鿿]{2,4}(?:中学|初中|小学))高一/);
    if (m) return m[1];

    // Pattern 2: after 周, bare 2-4 CJK chars before 高一 (add 中学)
    m = filename.match(/周([一-鿿]{2,4})高一/);
    if (m) return m[1] + '中学';

    // Pattern 3: bare 2-4 CJK chars before 高一 (add 中学)
    m = filename.match(/([一-鿿]{2,4})高一/);
    if (m) return m[1] + '中学';

    // Fallback: look for CJK chars before 学生名单/学生
    m = filename.match(/([一-鿿]{2,4}(?:中学|初中|小学)?)(?:学生名单|学生)/);
    if (m) {
        var name = m[1];
        if (/(?:中学|初中|小学)$/.test(name)) return name;
        return name + '中学';
    }
    return '';
}

// ══════════════════════════════════════
// SECTION A: 座位表 & 评价打分表
// ══════════════════════════════════════

$('list-file').addEventListener('change', function() {
    var file = this.files[0];
    if (!file) return;
    var status = $('upload-status-a');
    setLoading(status, '解析中...');

    var fd = new FormData();
    fd.append('file', file);
    fetch('/api/parse-student-list', { method: 'POST', body: fd })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.error) { setErr(status, data.error); return; }
        dataA = data;
        setOK(status, '已解析 ' + Object.keys(data.classes).length + ' 个班级');
        $('school-name-a').value = extractSchool(file.name);

        // Populate class dropdown
        var sel = $('class-select-a');
        sel.innerHTML = '';
        for (var cn in data.classes) {
            var info = data.classes[cn];
            sel.innerHTML += '<option value="' + cn + '">' + cn +
                ' (' + info.student_count + '人)</option>';
        }
        $('panel-a').style.display = 'block';
        updateProjectsA();
        loadStudentsA();
    })
    .catch(function() { setErr(status, '网络错误'); });
});

$('class-select-a').addEventListener('change', function() {
    updateProjectsA();
    loadStudentsA();
});

$('project-select-a').addEventListener('change', loadStudentsA);

function updateProjectsA() {
    var cn = $('class-select-a').value;
    if (!dataA || !dataA.classes[cn]) return;
    var sel = $('project-select-a');
    sel.innerHTML = '<option value="">全部学生</option>';
    var info = dataA.classes[cn];
    for (var i = 0; i < info.projects.length; i++) {
        var p = info.projects[i];
        var cnt = info.project_details[p] || '?';
        sel.innerHTML += '<option value="' + p + '">' + p + ' (' + cnt + '人)</option>';
    }
}

function loadStudentsA() {
    var cn = $('class-select-a').value;
    var proj = $('project-select-a').value;
    if (!cn || !dataA) return;

    var cd = dataA._data[cn];
    if (!cd) return;

    fetch('/api/get-class-students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ class_data: cd, project: proj }),
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
        studentsA = d.students;
        $('count-a').textContent = d.count;
        $('male-a').textContent = d.males;
        $('female-a').textContent = d.females;
        $('summary-a').style.display = 'block';
    });
}

function previewA() {
    if (!studentsA.length) { toast('请先选择班级和项目', 'error'); return; }
    fetch('/api/preview-seating', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            students: studentsA,
            arrange_mode: $('arrange-mode-a').value,
            separate_gender: $('arrange-mode-a').value === 'gender_alternate',
        }),
    })
    .then(function(r) { return r.json(); })
    .then(renderPreviewA);
}

function renderPreviewA(data) {
    var container = $('preview-a');
    // Build a simple grid overview
    var posMap = {};
    for (var i = 0; i < data.positions.length; i++) {
        var p = data.positions[i];
        posMap[p.row + '-' + p.col] = p;
    }

    // Classroom grid: rows 5-12, cols B-F
    var rows = [5,6,7,8,9,10,11,12];
    var cols = ['B','C','D','E','F'];
    var html = '<div class="seating-preview-wrap"><table>';

    for (var ri = 0; ri < rows.length; ri++) {
        var r = rows[ri];
        html += '<tr>';
        for (var ci = 0; ci < cols.length; ci++) {
            var c = cols[ci];
            var key = r + '-' + c;
            var p = posMap[key];

            if (c === 'D') {
                html += '<td class="seat-aisle"></td>';
            } else if (p) {
                var genderCls = p.student.gender === '女' ? 'female' : 'male';
                html += '<td class="seat-cell ' + genderCls + '">' +
                    p.student.id + ' ' + p.student.name + '</td>';
            } else {
                html += '<td class="seat-cell empty-seat">空</td>';
            }
        }
        html += '</tr>';
        // After last desk row (12), add podium indicator
        if (r === 12) {
            html += '<tr><td colspan="5" class="podium-row">🏫 讲  台</td></tr>';
        }
    }
    html += '</table>';

    if (data.unassigned && data.unassigned.length > 0) {
        html += '<div class="unassigned-warning">超出28人：' +
            data.unassigned.map(function(s) { return s.name; }).join('、') + '</div>';
    }
    html += '</div>';
    container.innerHTML = html;
}

function genSeating() {
    if (!studentsA.length) { toast('请先选择班级和项目', 'error'); return; }
    var school = $('school-name-a').value || $('class-select-a').value;
    var cls = $('class-select-a').value;
    var proj = $('project-select-a').value;
    var mode = $('arrange-mode-a').value;

    fetch('/api/generate-seating', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            students: studentsA,
            school_name: school,
            class_name: cls,
            project_name: proj,
            arrange_mode: mode,
            separate_gender: mode === 'gender_alternate',
            generate_duty: $('gen-duty-a').checked,
        }),
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
        if (d.download_url) {
            window.location.href = d.download_url;
            toast('座位表下载中...', 'success');
        }
    });
}

function genEval() {
    if (!studentsA.length) { toast('请先选择班级和项目', 'error'); return; }
    var school = $('school-name-a').value || $('class-select-a').value;
    var cls = $('class-select-a').value;
    var proj = $('project-select-a').value;
    var tpl = $('template-select-a').value || '3d';

    fetch('/api/generate-evaluation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            students: studentsA,
            school_name: school,
            class_name: cls,
            project_name: proj,
            template_id: tpl,
        }),
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
        if (d.download_url) {
            window.location.href = d.download_url;
            toast('评价表下载中...', 'success');
        }
    });
}

// ══════════════════════════════════════
// SECTION B: 评语自动生成
// ══════════════════════════════════════

$('grades-file').addEventListener('change', function() {
    var file = this.files[0];
    if (!file) return;
    var status = $('upload-status-b');
    setLoading(status, '上传并生成评语中...');

    var fd = new FormData();
    fd.append('file', file);
    fetch('/api/upload-grades', { method: 'POST', body: fd })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.error) { setErr(status, data.error); return; }
        dataB = data;
        setOK(status, '评语已生成，共 ' + data.count + ' 人');
        $('panel-b').style.display = 'block';

        // Show preview table
        var html = '<div class="comments-table-wrap"><table class="comments-table"><thead><tr>' +
            '<th>学号</th><th>姓名</th><th>性别</th><th>成绩</th><th>评语</th>' +
            '</tr></thead><tbody>';
        for (var i = 0; i < data.students.length; i++) {
            var s = data.students[i];
            html += '<tr>' +
                '<td>' + s.id + '</td>' +
                '<td>' + s.name + '</td>' +
                '<td>' + s.gender + '</td>' +
                '<td class="grade-' + s.grade_level + '">' + (s.grade_level || '-') + '</td>' +
                '<td class="comment-cell">' + (s.comment || '') + '</td>' +
                '</tr>';
        }
        html += '</tbody></table></div>';
        $('preview-b').innerHTML = html;
    })
    .catch(function() { setErr(status, '网络错误'); });
});

function downloadComments() {
    if (dataB && dataB.download_url) {
        window.location.href = dataB.download_url;
        toast('评语Excel下载中...', 'success');
    }
}

// ── Init drag & drop for both upload areas ──
setupDragDrop($('upload-area-a'), $('list-file'));
setupDragDrop($('upload-area-b'), $('grades-file'));
