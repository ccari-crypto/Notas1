const DEFAULT = { 
    global: { 
        title: "Registro de Evaluaciones", 
        year: 2026, 
        color: "#2c3e50", 
        profName: "", 
        profRole: "", 
        imgProf: null, 
        imgLogo: null 
    }, 
    semester: 1, 
    activeCourseIdx: 0, 
    courses: [{ 
        id: 'c1', 
        name: "1° Medio A", 
        color: "#2c3e50", 
        params: { 
            min: 1.0, 
            pass: 4.0, 
            max: 7.0, 
            ex: 60 
        }, 
        students: [{id: 's1', name: ''}], 
        sem1: { 
            evals: [{name: "Eval 1", max: 45, weight: 20}], 
            scores: {} 
        }, 
        sem2: { 
            evals: [{name: "Eval 1", max: 45, weight: 20}], 
            scores: {} 
        } 
    }] 
};

let app = JSON.parse(localStorage.getItem('gradebook_v10')) || DEFAULT;
let currentReportText = "";
let dragSrc = null;

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    loadGlobalUI();
    render();
    setupEventListeners();
});

function save() { 
    localStorage.setItem('gradebook_v10', JSON.stringify(app)); 
}

// --- CORE FUNCTIONS ---
function getActiveCourse() { 
    if(app.courses.length === 0) return null; 
    if(app.activeCourseIdx >= app.courses.length) app.activeCourseIdx = 0; 
    return app.courses[app.activeCourseIdx]; 
}

function calculateGrade(score, total, params) { 
    if(score === "" || score === null || isNaN(parseFloat(score))) return null;
    score = parseFloat(score); 
    total = parseFloat(total); 
    if(total <= 0) return null;
    
    const exigence = params.ex / 100;
    const cut = total * exigence;
    
    let grade;
    if(score < cut) {
        grade = params.min + ((params.pass - params.min) * score) / cut;
    } else {
        grade = params.pass + ((params.max - params.pass) * (score - cut)) / (total - cut);
    }
    return Math.round(grade * 10) / 10;
}

function calculateWeightedAvg(studentId, semData, params) {
    let totalWeighted = 0;
    let totalWeights = 0;
    let hasGrades = false;

    semData.evals.forEach((ev, i) => {
        const scores = semData.scores[studentId] || [];
        const val = scores[i];
        if(val !== undefined && val !== "" && val !== null) {
            const grade = calculateGrade(val, ev.max, params);
            const weight = parseFloat(ev.weight) || 0;
            if(grade !== null) {
                totalWeighted += grade * weight;
                totalWeights += weight;
                hasGrades = true;
            }
        }
    });

    if (!hasGrades) return null;
    if (totalWeights === 0) return 0;
    
    return Math.round((totalWeighted / totalWeights) * 10) / 10;
}

// --- REPORT FUNCTIONS ---
function openReportModal() {
    const c = getActiveCourse(); 
    if(!c) return;
    
    const select = document.getElementById('rptEvalSelect'); 
    select.innerHTML = "";
    const semData = app.semester === 1 ? c.sem1 : c.sem2;
    
    semData.evals.forEach((ev, i) => { 
        const opt = document.createElement('option'); 
        opt.value = i; 
        opt.innerText = ev.name || `Eval ${i+1}`; 
        select.appendChild(opt); 
    });
    
    toggleReportUI(); 
    document.getElementById('reportOutput').innerHTML = ""; 
    currentReportText = ""; 
    document.getElementById('reportModal').style.display = 'flex';
}

function toggleReportUI() { 
    const type = document.querySelector('input[name="rptType"]:checked').value; 
    document.getElementById('rptEvalSelect').style.display = type === 'eval' ? 'block' : 'none'; 
}

function generateReport() {
    const c = getActiveCourse();
    const semData = app.semester === 1 ? c.sem1 : c.sem2;
    const type = document.querySelector('input[name="rptType"]:checked').value;
    const passGrade = c.params.pass;
    let list = "", header = "", count = 0;

    if (type === 'eval') {
        const idx = document.getElementById('rptEvalSelect').value;
        const ename = semData.evals[idx].name || "Evaluación";
        header = `Estimados apoderados, esperando se encuentren bien, quiero comunicar que los siguientes estudiantes tuvieron nota insuficiente en la evaluación "${ename}", a continuación el detalle:`;
        
        c.students.forEach(s => {
            const val = (semData.scores[s.id]||[])[idx];
            const g = calculateGrade(val, semData.evals[idx].max, c.params);
            if (g !== null && g < passGrade) { 
                list += `- ${s.name || "Sin Nombre"}: Nota ${g.toFixed(1)}\n`; 
                count++; 
            }
        });
    } else {
        header = `Estimados apoderados, esperando se encuentren bien, quiero comunicar que los siguientes estudiantes presentan un promedio semestral insuficiente, a continuación el detalle:`;
        
        c.students.forEach(s => {
            const avg = calculateWeightedAvg(s.id, semData, c.params);
            if(avg !== null && avg < passGrade) { 
                list += `- ${s.name || "Sin Nombre"}: Promedio ${avg.toFixed(1)}\n`; 
                count++; 
            }
        });
    }

    const footer = `\nPor más detalles, agendar entrevista con docente al siguiente mail\nc.cari@nsmquilpue.cl, sin otro particular, se despide cordialmente, Profesor Cristian Cari.`;

    if (count === 0) {
        currentReportText = ""; 
        document.getElementById('reportOutput').innerHTML = "<span style='color:green'>No hay estudiantes en riesgo.</span>";
    } else {
        currentReportText = `${header}\n\n${list}${footer}`; 
        document.getElementById('reportOutput').innerText = currentReportText;
    }
}

// --- HANDLERS ---
function handleScoreInput(sid, idx, el) {
    const value = el.value;
    const c = getActiveCourse();
    const d = app.semester === 1 ? c.sem1 : c.sem2;
    
    if(!d.scores[sid]) d.scores[sid] = [];
    d.scores[sid][idx] = value; 
    save();
    
    const grade = calculateGrade(value, d.evals[idx].max, c.params);
    const badge = document.getElementById(`badge-${sid}-${idx}`);
    
    if(badge) { 
        badge.innerText = grade !== null ? grade.toFixed(1) : ""; 
        badge.className = `grade-badge ${grade !== null && grade < c.params.pass ? 'rojo' : 'azul'}`; 
    }

    updateFinalAvg(sid);
}

function updateFinalAvg(sid) {
    const c = getActiveCourse();
    const d = app.semester === 1 ? c.sem1 : c.sem2;
    const avg = calculateWeightedAvg(sid, d, c.params);
    const cell = document.getElementById(`avg-${sid}`);
    
    if(cell) {
        cell.innerText = avg !== null ? avg.toFixed(1) : "";
        cell.style.color = (avg !== null && avg < c.params.pass) ? "var(--rojo)" : "var(--azul)";
    }
}

function handleEvalNameChange(i, v) { 
    const c = getActiveCourse(); 
    (app.semester === 1 ? c.sem1 : c.sem2).evals[i].name = v; 
    save(); 
}

function handleEvalMaxChange(i, v) { 
    const c = getActiveCourse(); 
    (app.semester === 1 ? c.sem1 : c.sem2).evals[i].max = v; 
    save(); 
    render(); 
}

function handleEvalWeightChange(i, v) { 
    const c = getActiveCourse(); 
    (app.semester === 1 ? c.sem1 : c.sem2).evals[i].weight = v; 
    save(); 
    render();
}

// --- ACCIONES ---
function addCourse() { 
    const name = prompt("Nombre del curso:");
    if(!name) return;
    
    app.courses.push({
        id: 'c' + Date.now(),
        name: name,
        color: app.global.color,
        params: {
            min: 1.0,
            pass: 4.0,
            max: 7.0,
            ex: 60
        },
        students: [{id: 's' + Date.now(), name: ''}],
        sem1: {
            evals: [{name: "Eval 1", max: 45, weight: 20}],
            scores: {}
        },
        sem2: {
            evals: [{name: "Eval 1", max: 45, weight: 20}],
            scores: {}
        }
    });
    
    app.activeCourseIdx = app.courses.length - 1; 
    save(); 
    render(); 
}

function deleteCourse() { 
    if(!confirm("¿Borrar curso?")) return;
    app.courses.splice(app.activeCourseIdx, 1);
    app.activeCourseIdx = 0; 
    save(); 
    render(); 
}

function addStudent() { 
    const c = getActiveCourse(); 
    if(!c) return;
    c.students.push({id: 's' + Date.now(), name: ''}); 
    save(); 
    render(); 
}

function removeStudent() { 
    const c = getActiveCourse(); 
    if(!c || c.students.length === 0) return;
    
    if(confirm("¿Eliminar último estudiante?")) { 
        c.students.pop(); 
        save(); 
        render(); 
    } 
}

function addEval() { 
    const c = getActiveCourse(); 
    if(!c) return;
    (app.semester === 1 ? c.sem1 : c.sem2).evals.push({name: `Eval`, max: 45, weight: 10}); 
    save(); 
    render(); 
}

function removeEval() { 
    const c = getActiveCourse();
    const d = app.semester === 1 ? c.sem1 : c.sem2;
    
    if(!c) return;
    if(d.evals.length > 0 && confirm("¿Borrar última evaluación?")) { 
        d.evals.pop(); 
        save(); 
        render(); 
    } 
}

function updateCourseParams() { 
    const c = getActiveCourse(); 
    c.params.min = parseFloat(document.getElementById('cMin').value);
    c.params.pass = parseFloat(document.getElementById('cPass').value);
    c.params.max = parseFloat(document.getElementById('cMax').value);
    c.params.ex = parseFloat(document.getElementById('cEx').value);
    save(); 
    render(); 
}

function updateCourseColor(v) { 
    getActiveCourse().color = v; 
    save(); 
    render(); 
}

// --- DRAG & DROP ---
function handleDragStart(e) { 
    this.classList.add('dragging');
    dragSrc = this;
    e.dataTransfer.setData('idx', this.getAttribute('data-idx'));
}

function handleDrop(e) { 
    e.stopPropagation(); 
    const fromIdx = parseInt(e.dataTransfer.getData('idx'));
    const toIdx = parseInt(this.getAttribute('data-idx'));
    
    if(fromIdx !== toIdx) { 
        const moved = app.courses.splice(fromIdx, 1)[0];
        app.courses.splice(toIdx, 0, moved);
        app.activeCourseIdx = toIdx;
        save(); 
        render(); 
    } 
    return false;
}

// --- UTILITIES ---
function uploadImage(type, input) { 
    const file = input.files[0]; 
    if(!file || file.size > 800000) return alert("Error: imagen demasiado grande");
    
    const reader = new FileReader();
    reader.onload = e => {
        if(type === 'profile') app.global.imgProf = e.target.result;
        if(type === 'logo') app.global.imgLogo = e.target.result;
        save(); 
        loadGlobalUI();
    };
    reader.readAsDataURL(file);
}

function updateGlobal(key, value) { 
    app.global[key] = value; 
    save(); 
}

function loadGlobalUI() { 
    document.getElementById('displayTitle').innerText = app.global.title;
    document.getElementById('displayYear').innerText = app.global.year;
    document.documentElement.style.setProperty('--primary', app.global.color);
    document.getElementById('profName').value = app.global.profName;
    document.getElementById('profRole').value = app.global.profRole;
    
    if(app.global.imgProf) {
        document.getElementById('imgProfile').src = app.global.imgProf;
        document.getElementById('imgProfile').style.display = 'block';
        document.getElementById('iconProfile').style.display = 'none';
    }
    
    if(app.global.imgLogo) {
        document.getElementById('imgLogo').src = app.global.imgLogo;
        document.getElementById('imgLogo').style.display = 'block';
        document.getElementById('iconLogo').style.display = 'none';
    }
}

function shareWhatsapp() { 
    if(!currentReportText) return alert("Genera una lista primero");
    window.open(`https://wa.me/?text=${encodeURIComponent(currentReportText)}`, '_blank');
}

function shareMail() { 
    if(!currentReportText) return alert("Genera una lista primero");
    window.open(`mailto:?subject=Informe Calificaciones&body=${encodeURIComponent(currentReportText)}`);
}

function setSemester(s) { 
    app.semester = s; 
    save(); 
    render(); 
}

function openConfig() { 
    document.getElementById('confTitle').value = app.global.title;
    document.getElementById('confYear').value = app.global.year;
    document.getElementById('confColor').value = app.global.color;
    document.getElementById('configModal').style.display = 'flex';
}

function saveGlobalConfig() { 
    app.global.title = document.getElementById('confTitle').value;
    app.global.year = document.getElementById('confYear').value;
    app.global.color = document.getElementById('confColor').value;
    save(); 
    loadGlobalUI();
    document.getElementById('configModal').style.display = 'none';
}

function hardReset() { 
    if(confirm("¿Borrar todos los datos? Esto no se puede deshacer.")) { 
        localStorage.removeItem('gradebook_v10'); 
        location.reload(); 
    } 
}

// --- RENDER ---
function render() {
    const c = getActiveCourse();
    const tabs = document.getElementById('tabsContainer');
    const table = document.getElementById('tableContainer');
    
    document.getElementById('btnSem1').className = app.semester === 1 ? 'sem-btn active' : 'sem-btn';
    document.getElementById('btnSem2').className = app.semester === 2 ? 'sem-btn active' : 'sem-btn';
    
    // Tabs
    tabs.innerHTML = '';
    app.courses.forEach((course, i) => {
        const tab = document.createElement('div');
        tab.className = `course-tab ${i === app.activeCourseIdx ? 'active' : ''}`;
        tab.draggable = true;
        tab.setAttribute('data-idx', i);
        tab.innerHTML = `<i class="fas fa-grip-vertical" style="opacity:0.3"></i> ${course.name}`;
        
        if(i === app.activeCourseIdx) {
            tab.style.borderTopColor = course.color;
            tab.style.color = course.color;
        }
        
        tab.onclick = () => {
            app.activeCourseIdx = i;
            save();
            render();
        };
        
        tab.addEventListener('dragstart', handleDragStart);
        tab.addEventListener('dragover', e => e.preventDefault());
        tab.addEventListener('drop', handleDrop);
        tab.addEventListener('dragend', function() {
            this.classList.remove('dragging');
        });
        
        tabs.appendChild(tab);
    });

    if(!c) { 
        table.innerHTML = "<p style='text-align:center; padding:20px'>Crea un curso.</p>"; 
        return; 
    }
    
    // Toolbar inputs
    document.getElementById('cMin').value = c.params.min;
    document.getElementById('cPass').value = c.params.pass;
    document.getElementById('cMax').value = c.params.max;
    document.getElementById('cEx').value = c.params.ex;
    document.getElementById('cColor').value = c.color;

    const semData = app.semester === 1 ? c.sem1 : c.sem2;
    
    // HEADERS
    let html = `<table><thead><tr><th style="width:250px; background:${c.color}">Alumnos (${c.students.length})</th>`;
    
    semData.evals.forEach((ev, i) => {
        const weight = ev.weight !== undefined ? ev.weight : 0;
        html += `<th style="background:${c.color}">
            <input type="text" class="eval-name-input" value="${ev.name || 'Eval ' + (i + 1)}" 
                   placeholder="Nombre" data-eval-index="${i}" data-field="name">
            <div class="header-inputs-row">
                <label title="Puntaje Total">Pts:</label>
                <input type="number" class="mini-input" value="${ev.max}" 
                       data-eval-index="${i}" data-field="max">
                <label title="Porcentaje">%:</label>
                <input type="number" class="mini-input" value="${weight}" 
                       data-eval-index="${i}" data-field="weight">
            </div>
        </th>`;
    });
    
    html += `<th class="th-avg" style="width:80px;">Promedio</th>`;
    html += "</tr></thead><tbody>";
    
    // BODY
    c.students.forEach(student => {
        html += `<tr><td style="text-align:left">
            <input type="text" value="${student.name}" class="name-input" 
                   placeholder="Nombre..." data-student-id="${student.id}">
        </td>`;
        
        const scores = semData.scores[student.id] || [];
        
        semData.evals.forEach((ev, i) => {
            const value = scores[i] !== undefined ? scores[i] : "";
            const grade = calculateGrade(value, ev.max, c.params);
            const colorClass = grade ? (grade < c.params.pass ? 'rojo' : 'azul') : '';
            
            html += `<td>
                <input type="number" class="score-input" value="${value}" 
                       data-student-id="${student.id}" data-eval-index="${i}">
                <span id="badge-${student.id}-${i}" class="grade-badge ${colorClass}">
                    ${grade ? grade.toFixed(1) : ''}
                </span>
            </td>`;
        });

        const finalAvg = calculateWeightedAvg(student.id, semData, c.params);
        const finalColor = (finalAvg !== null && finalAvg < c.params.pass) ? "var(--rojo)" : "var(--azul)";
        
        html += `<td class="td-avg" style="color:${finalColor}" id="avg-${student.id}">
            ${finalAvg !== null ? finalAvg.toFixed(1) : ''}
        </td>`;
        
        html += "</tr>";
    });
    
    html += "</tbody></table>";
    table.innerHTML = html;
    
    // Reasignar event listeners
    setupDynamicEventListeners();
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
    // Profile image upload
    document.getElementById('fileProfile').addEventListener('change', (e) => {
        uploadImage('profile', e.target);
    });
    
    document.getElementById('fileLogo').addEventListener('change', (e) => {
        uploadImage('logo', e.target);
    });
    
    // Profile click handlers
    document.querySelector('.profile-pic').addEventListener('click', () => {
        document.getElementById('fileProfile').click();
    });
    
    document.querySelector('.school-logo').addEventListener('click', () => {
        document.getElementById('fileLogo').click();
    });
    
    // Profile inputs
    document.getElementById('profName').addEventListener('change', (e) => {
        updateGlobal('profName', e.target.value);
    });
    
    document.getElementById('profRole').addEventListener('change', (e) => {
        updateGlobal('profRole', e.target.value);
    });
    
    // Semester buttons
    document.getElementById('btnSem1').addEventListener('click', () => setSemester(1));
    document.getElementById('btnSem2').addEventListener('click', () => setSemester(2));
    
    // Toolbar buttons
    document.getElementById('reportBtn').addEventListener('click', openReportModal);
    document.getElementById('addStudentBtn').addEventListener('click', addStudent);
    document.getElementById('removeStudentBtn').addEventListener('click', removeStudent);
    document.getElementById('addEvalBtn').addEventListener('click', addEval);
    document.getElementById('removeEvalBtn').addEventListener('click', removeEval);
    document.getElementById('addCourseBtn').addEventListener('click', addCourse);
    document.getElementById('deleteCourseBtn').addEventListener('click', deleteCourse);
    
    // Course params
    document.getElementById('cMin').addEventListener('change', updateCourseParams);
    document.getElementById('cPass').addEventListener('change', updateCourseParams);
    document.getElementById('cMax').addEventListener('change', updateCourseParams);
    document.getElementById('cEx').addEventListener('change', updateCourseParams);
    document.getElementById('cColor').addEventListener('change', (e) => {
        updateCourseColor(e.target.value);
    });
    
    // Config modal
    document.getElementById('configBtn').addEventListener('click', openConfig);
    document.getElementById('saveConfigBtn').addEventListener('click', saveGlobalConfig);
    document.getElementById('cancelConfigBtn').addEventListener('click', () => {
        document.getElementById('configModal').style.display = 'none';
    });
    document.getElementById('hardResetBtn').addEventListener('click', hardReset);
    
    // Report modal
    document.querySelectorAll('input[name="rptType"]').forEach(radio => {
        radio.addEventListener('change', toggleReportUI);
    });
    
    document.getElementById('generateReportBtn').addEventListener('click', generateReport);
    document.getElementById('whatsappShareBtn').addEventListener('click', shareWhatsapp);
    document.getElementById('mailShareBtn').addEventListener('click', shareMail);
    document.getElementById('closeReportBtn').addEventListener('click', () => {
        document.getElementById('reportModal').style.display = 'none';
    });
}

function setupDynamicEventListeners() {
    // Student name inputs
    document.querySelectorAll('.name-input[data-student-id]').forEach(input => {
        input.addEventListener('change', function() {
            const studentId = this.getAttribute('data-student-id');
            const c = getActiveCourse();
            const student = c.students.find(s => s.id === studentId);
            if(student) {
                student.name = this.value;
                save();
            }
        });
    });
    
    // Score inputs
    document.querySelectorAll('.score-input[data-student-id]').forEach(input => {
        input.addEventListener('input', function() {
            const studentId = this.getAttribute('data-student-id');
            const evalIndex = parseInt(this.getAttribute('data-eval-index'));
            handleScoreInput(studentId, evalIndex, this);
        });
    });
    
    // Evaluation header inputs
    document.querySelectorAll('.eval-name-input[data-eval-index]').forEach(input => {
        input.addEventListener('change', function() {
            const evalIndex = parseInt(this.getAttribute('data-eval-index'));
            const field = this.getAttribute('data-field');
            
            if(field === 'name') {
                handleEvalNameChange(evalIndex, this.value);
            }
        });
    });
    
    document.querySelectorAll('.mini-input[data-eval-index]').forEach(input => {
        input.addEventListener('change', function() {
            const evalIndex = parseInt(this.getAttribute('data-eval-index'));
            const field = this.getAttribute('data-field');
            const value = this.value;
            
            if(field === 'max') {
                handleEvalMaxChange(evalIndex, value);
            } else if(field === 'weight') {
                handleEvalWeightChange(evalIndex, value);
            }
        });
    });
}