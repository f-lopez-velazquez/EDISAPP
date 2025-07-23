// main.js

// --- 1. Inicialización Firebase y variables globales ---
const firebaseConfig = {
  apiKey: "AIzaSyDtShAFym0sPrrkocsY48oAB2W4wbUD9ZY",
  authDomain: "edisapp-54c5c.firebaseapp.com",
  projectId: "edisapp-54c5c",
  storageBucket: "edisapp-54c5c.appspot.com",
  messagingSenderId: "1022245708836",
  appId: "1:1022245708836:web:5031161ed56f7d162524b1"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

const ADMIN = "edis.ugto@gmail.com";
let currentUser = null;
let autoSaveInterval = null;
let formDraft = null;
let currentTabE = () => "letra"; // función, cambia según tab activo en editor

const root = document.getElementById('root');

// --- 2. Header y login ---
function renderHeader(user) {
  return `
    <div class="header">
      <img src="https://i.imgur.com/N6rdt5B.png" alt="EDIS Logo">
      <h1>Cancionero EDIS</h1>
      <div>
        ${user ? `
          <span style="margin-right:12px;font-weight:600">${user.email}</span>
          <button class="btn" id="logoutBtn">Salir</button>
        ` : `
          <button class="btn" id="showLoginBtn">Iniciar sesión</button>
        `}
      </div>
    </div>
  `;
}
function showLoginForm() {
  root.innerHTML = renderHeader(null) + `
    <div class="flex-center" style="min-height:70vh;">
      <form id="loginForm" class="glass" style="padding:2em 2em;max-width:350px;width:100%;margin:2em auto;">
        <h2 style="text-align:center;font-weight:700;color:var(--primary)">Acceso</h2>
        <input required name="email" type="email" placeholder="Correo" autocomplete="username"/>
        <input required name="pass" type="password" placeholder="Contraseña" autocomplete="current-password"/>
        <button class="btn w100" type="submit">Entrar</button>
      </form>
    </div>`;
  document.getElementById("loginForm").onsubmit = async e => {
    e.preventDefault();
    const email = e.target.email.value.trim();
    const pass = e.target.pass.value.trim();
    try {
      await auth.signInWithEmailAndPassword(email, pass);
      currentUser = auth.currentUser;
      renderHome();
    } catch (e) {
      alert("Usuario/Contraseña incorrectos");
    }
  };
  document.getElementById("showLoginBtn")?.addEventListener("click", showLoginForm);
}
function setupLogout() {
  document.getElementById("logoutBtn").onclick = async ()=>{
    await auth.signOut();
    currentUser = null;
    showLoginForm();
  }
}

// --- 3. Home: lista de canciones ---
async function renderHome() {
  root.innerHTML = renderHeader(currentUser) + `
    <main class="glass" style="margin:2vw auto;max-width:800px;padding:2em;min-height:400px">
      <div class="flex-between mb1">
        <h2 style="color:var(--primary)">Canciones</h2>
        ${currentUser?.email === ADMIN ? `<button class="btn" id="addSongBtn">+ Nueva Canción</button>` : ""}
      </div>
      <div id="songsList"></div>
      <div id="songView"></div>
    </main>
  `;
  setupLogout();
  loadSongs();
  if(currentUser?.email === ADMIN) document.getElementById("addSongBtn").onclick = ()=> renderSongEditor();
}

async function loadSongs() {
  const list = document.getElementById('songsList');
  list.innerHTML = "Cargando...";
  const snap = await db.collection("songs").orderBy("title").get();
  if(snap.empty) {
    list.innerHTML = `<div style="text-align:center;">No hay canciones aún.</div>`;
    return;
  }
  list.innerHTML = `
    <div class="song-list">
      ${snap.docs.map(doc=>`
        <div class="song-item">
          <span style="font-weight:600">${doc.data().title||'Sin título'}</span>
          <div>
            <button class="btn" style="padding:.5em 1em;font-size:.97em" onclick="viewSong('${doc.id}')">Ver</button>
            ${currentUser?.email===ADMIN?`
              <button class="btn" style="background:#fff;color:var(--primary);margin-left:.7em;" onclick="editSong('${doc.id}')">Editar</button>
            `:''}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

window.editSong = function(id){ renderSongEditor(id); }
window.viewSong = function(id){ renderSongView(id); }

// --- 4. Visor de canción ---
async function renderSongView(id){
  const doc = await db.collection("songs").doc(id).get();
  if(!doc.exists) return alert("No encontrada");
  const d = doc.data();
  document.getElementById('songView').innerHTML = `
    <div class="mt-2">
      <div class="flex-between mb1">
        <h3 style="color:var(--secondary);">${d.title||''}</h3>
        <div>
          <button class="btn" style="background:#fff;color:var(--primary);font-size:.93em" onclick="downloadPDF('${id}')">PDF</button>
          ${d.audioUrl?`<audio src="${d.audioUrl}" controls style="vertical-align:middle;margin-left:8px;max-width:160px;"></audio>`:''}
        </div>
      </div>
      <div class="tabs" id="tabsV">
        <button class="tab active" data-tab="letra">Letra</button>
        <button class="tab" data-tab="letraAcordes">Letra con Acordes</button>
        <button class="tab" data-tab="guitarra">Guitarra</button>
        <button class="tab" data-tab="mandolina">Tricordio/Mandolina</button>
        <button class="tab" data-tab="bandurria">Bandurria</button>
        <button class="tab" data-tab="laud">Laúd</button>
        <button class="tab" data-tab="contrabajo">Contrabajo</button>
        <button class="tab" data-tab="guitarron">Guitarrón</button>
      </div>
      <div id="tabContentV"></div>
      <div class="flex-center" style="margin:2em 0 1em;">
        <button class="btn" onclick="startLivePractice('${id}')">Ensayar en vivo</button>
      </div>
    </div>
  `;
  setupTabs("V","letra",false);
}
// --- 5. Editor de canción (con draft y autosave pro) ---
async function renderSongEditor(id){
  if(currentUser?.email!==ADMIN) return;
  let data = {
    title: "", letra: "", letraAcordes: [],
    guitarra: [], mandolina: [], bandurria: [], laud: [],
    contrabajo: [], guitarron: [], audioUrl: ""
  };
  if(id){
    const doc = await db.collection("songs").doc(id).get();
    if(doc.exists) data = Object.assign(data,doc.data());
  }
  // Usamos formDraft para mantener los cambios entre tabs
  formDraft = Object.assign({}, data);

  document.getElementById('songView').innerHTML = `
    <form id="songEditForm" class="glass" style="padding:2em;">
      <h3 style="color:var(--secondary);margin-bottom:.7em">${id?'Editar':'Nueva'} canción</h3>
      <input required name="title" value="${formDraft.title||''}" placeholder="Título de la canción" id="field_title"/>
      <div class="tabs" id="tabsE">
        <button class="tab active" data-tab="letra">Letra</button>
        <button class="tab" data-tab="letraAcordes">Letra con Acordes</button>
        <button class="tab" data-tab="guitarra">Guitarra</button>
        <button class="tab" data-tab="mandolina">Tricordio/Mandolina</button>
        <button class="tab" data-tab="bandurria">Bandurria</button>
        <button class="tab" data-tab="laud">Laúd</button>
        <button class="tab" data-tab="contrabajo">Contrabajo</button>
        <button class="tab" data-tab="guitarron">Guitarrón</button>
      </div>
      <div id="tabContentE"></div>
      <div style="margin:1em 0">
        <label style="font-size:.95em;font-weight:600;color:var(--primary)">Audio:</label><br>
        <input type="file" id="audioUpload" accept="audio/*"/>
        ${formDraft.audioUrl?`<audio src="${formDraft.audioUrl}" controls style="vertical-align:middle;max-width:200px;"></audio>`:''}
      </div>
      <div class="flex-between">
        <button class="btn" type="submit">${id?'Guardar':'Crear'}</button>
        <button type="button" class="btn" style="background:#eee;color:#333" onclick="cancelEdit()">Cancelar</button>
      </div>
    </form>
  `;
  setupTabs("E","letra",true);

  document.getElementById('songEditForm').onsubmit = async e=>{
    e.preventDefault();
    const f = e.target;
    syncTabDraft(currentTabE());
    formDraft.title = f.title.value;
    // Guardar audio
    const file = document.getElementById("audioUpload").files[0];
    if(file){
      const ref = storage.ref().child("audios/"+(id||formDraft.title)+Date.now());
      await ref.put(file);
      formDraft.audioUrl = await ref.getDownloadURL();
    }
    if(id) await db.collection("songs").doc(id).set(formDraft);
    else await db.collection("songs").add(formDraft);
    document.getElementById('songView').innerHTML = `
      <div class="flex-center" style="padding:3em 0">
        <h2 style="color:var(--secondary);text-align:center">¡Canción guardada correctamente!</h2>
      </div>
    `;
    setTimeout(renderHome, 1200);
  };
  window.cancelEdit = function(){ renderHome(); }

  // Autosave
  if(autoSaveInterval) clearInterval(autoSaveInterval);
  autoSaveInterval = setInterval(()=>{
    syncTabDraft(currentTabE());
    localStorage.setItem('edis_autosave_'+(id||'new'), JSON.stringify(formDraft));
  },20000);
}

// Sincroniza cambios del tab actual en el draft
function syncTabDraft(tab){
  if(!formDraft) return;
  let t = document.getElementById("field_title");
  if(t) formDraft.title = t.value;
  if(tab === "letra") formDraft.letra = document.getElementById("field_letra")?.value||"";
  if(tab === "letraAcordes"){
    let linesL = (document.getElementById("acordesLetra")?.value||"").split("\n");
    let linesA = (document.getElementById("acordesAcordes")?.value||"").split("\n");
    let arr = [];
    for(let i=0;i<linesL.length;i++){
      let chars = linesL[i].split('');
      let acordes = (linesA[i]||"").split('\t');
      arr.push(chars.map((c,j)=>({char:c,acorde:acordes[j]||""})));
    }
    formDraft.letraAcordes = arr;
  }
  ["guitarra","mandolina","bandurria","laud","contrabajo","guitarron"].forEach(tipo=>{
    if(tab === tipo){
      let val = document.getElementById(`tabEditor_${tipo}`)?.value||"";
      try { formDraft[tipo] = JSON.parse(val); } catch{ formDraft[tipo]=[]; }
    }
  });
}

// --- 6. Tabs dinámicos para visor/editor ---
function setupTabs(mode, initTab, isEdit){
  let container = document.getElementById('tabContent'+mode);
  const tabIds = ["letra","letraAcordes","guitarra","mandolina","bandurria","laud","contrabajo","guitarron"];
  let currentTab = initTab||tabIds[0];
  currentTabE = ()=>currentTab;
  function show(tab){
    if(isEdit) syncTabDraft(currentTab);
    currentTab = tab;
    document.querySelectorAll("#tabs"+mode+" .tab").forEach(el=>el.classList.remove("active"));
    document.querySelector(`#tabs${mode} .tab[data-tab=${tab}]`).classList.add("active");
    let data = (isEdit && formDraft) ? formDraft : undefined;
    container.innerHTML = getTabContent(tab,data||{},isEdit,mode);
  }
  document.querySelectorAll("#tabs"+mode+" .tab").forEach(btn=>{
    btn.onclick = (e)=>{ e.preventDefault(); show(btn.dataset.tab);}
  });
  show(currentTab);
}

// --- 7. Letra con acordes visual PRO ---
function getTabContent(tab, data, isEdit, mode){
  // ---- Letra ----
  if(tab==="letra") {
    if(isEdit){
      return `<textarea rows="9" id="field_letra" placeholder="Letra simple" oninput="if(formDraft)formDraft.letra=this.value;">${data.letra||''}</textarea>`;
    } else {
      return `<pre style="white-space:pre-wrap;font-size:1.1em">${data.letra||'<em>No definida</em>'}</pre>`;
    }
  }
  // ---- Letra con Acordes (editor visual pro) ----
  if(tab==="letraAcordes") {
    if(isEdit){
      let base = [];
      if (data.letraAcordes && data.letraAcordes.length > 0) base = data.letraAcordes;
      else if (data.letra) base = data.letra.split("\n").map(line => line.split('').map(c => ({ char: c, acorde: "" })));
      // Actualiza en vivo si cambia la letra
      setTimeout(()=>{
        let letraTxt = document.getElementById("field_letra");
        if(letraTxt){
          letraTxt.oninput = function(){
            let newLines = this.value.split("\n");
            let oldAcordes = document.getElementById("acordesAcordes")?.value.split("\n")||[];
            let nuevaBase = newLines.map((line,i) => line.split('').map((char,j)=>({
              char, acorde: (oldAcordes[i]||"").split('\t')[j]||""
            })));
            document.getElementById("acordesLetra").value = newLines.join("\n");
          }
        }
      },50);
      return `
        <div>
          <p style="font-size:.93em;color:var(--primary)">
            La letra se toma de la pestaña "Letra".<br>
            Escribe acordes sobre cada letra. Se alinea y guarda.
          </p>
          <textarea rows="7" id="acordesLetra" disabled style="background:#f5f5f5">${base.map(line=>line.map(pair=>pair.char).join("")).join("\n")}</textarea>
          <textarea rows="7" id="acordesAcordes" placeholder="Acordes (uno por caracter, separar tabs para acordes en blanco)...">${base.map(line=>line.map(pair=>pair.acorde||"").join("\t")).join("\n")}</textarea>
          <p style="font-size:.95em;color:#6bb1de;margin:5px 0">
            <b>Tip:</b> Usa tabulador para alinear acordes.
          </p>
        </div>
      `;
    } else {
      let ac = data.letraAcordes || [];
      if(!ac.length) return "<em>No definido</em>";
      return renderAcordesViewer(ac);
    }
  }
  // ---- Instrumentos: tablatura gráfica pro (en parte 3/4) ----
  if(["guitarra","mandolina","bandurria","laud","contrabajo","guitarron"].includes(tab)){
    if(isEdit){
      return renderTablatureEditor(tab, data[tab]||[]);
    } else {
      return renderTablatureViewer(tab, data[tab]||[]);
    }
  }
  return `<div>No implementado aún.</div>`;
}

// --- 8. Letra con acordes: visor pro ---
function renderAcordesViewer(base){
  return `
    <div style="font-family:monospace;font-size:1.08em">
      ${base.map(line=>`
        <div>
          <div>
            ${line.map(pair=>`<span style="display:inline-block;width:1ch;text-align:center;color:#6bb1de;font-size:.98em">${pair.acorde||"&nbsp;"}</span>`).join("")}
          </div>
          <div>
            ${line.map(pair=>`<span style="display:inline-block;width:1ch;text-align:center;">${pair.char}</span>`).join("")}
          </div>
        </div>
      `).join("")}
    </div>
  `;
}
// --- 9. Editor gráfico de tablaturas profesional (pro para todos los instrumentos) ---
function renderTablatureEditor(tipo, arr){
  // Cantidad de cuerdas por instrumento
  let cuerdas = 6;
  if(tipo==="mandolina"||tipo==="contrabajo") cuerdas = 4;

  // Estructura de la tablatura: [{arreglo:"arreglo1", data:[{time, cuerda, value, tipo}]}]
  // Si no hay, creamos el primer arreglo y 8 tiempos vacíos
  let arreglos = arr && arr.length ? arr : [{arreglo:"Principal", data:[]}];
  let idx = 0; // índice del arreglo activo
  let data = arreglos[idx].data || [];

  // Calcular tiempos (max + 1 por defecto 8)
  let tiempos = Math.max(7, ...data.map(n=>n.time));
  // Interface de arreglos (puedes agregar/quitar)
  let arreglosBtns = arreglos.map((a,i)=>`
    <button type="button" class="tab-arreglo-btn${i===idx?' active':''}" onclick="tabChangeArreglo('${tipo}',${i})">${a.arreglo||'Arreglo '+(i+1)}</button>
  `).join('') + `<button type="button" class="tab-arreglo-btn" onclick="tabAddArreglo('${tipo}')">+ Arreglo</button>`;

  // Canvas para la tablatura
  setTimeout(()=>tabDrawCanvas(tipo,cuerdas,tiempos,data,idx), 0);

  return `
    <div class="tab-arreglos">${arreglosBtns}</div>
    <div style="overflow-x:auto;">
      <div id="tab-canvas-${tipo}" class="tab-canvas" style="min-height:${cuerdas*34+44}px"></div>
    </div>
    <div class="tab-btnbar">
      <button class="tab-btn" onclick="tabAddTime('${tipo}')">+ Tiempo</button>
      <button class="tab-btn" onclick="tabDelTime('${tipo}')">- Tiempo</button>
    </div>
    <textarea id="tabEditor_${tipo}" class="hide">${JSON.stringify(arreglos,null,2)}</textarea>
    <div style="color:#444;font-size:.93em;margin:.5em 0 0 0">Haz clic en una cuerda para agregar/editar nota, rasgueo, muteo, etc. Clic sobre un icono para eliminarlo.</div>
  `;
}

// Manejo de arreglos/times (eventos globales por conveniencia)
window.tabAddArreglo = function(tipo){
  let arr = JSON.parse(document.getElementById(`tabEditor_${tipo}`).value);
  arr.push({arreglo:"Nuevo arreglo",data:[]});
  document.getElementById(`tabEditor_${tipo}`).value = JSON.stringify(arr,null,2);
  renderTablatureEditor(tipo, arr);
  setupTabs("E",tipo,true);
};
window.tabChangeArreglo = function(tipo,i){
  // TODO: implementa cambio de arreglo visual si quieres multi-arreglo (ver demo avanzada)
  alert("Por ahora, solo se edita el primer arreglo visualmente.");
};
window.tabAddTime = function(tipo){
  // No requiere acción en datos, ya que se agregan tiempos en el canvas según el máximo
  let arr = JSON.parse(document.getElementById(`tabEditor_${tipo}`).value);
  let data = arr[0].data||[];
  let tiempos = Math.max(7, ...data.map(n=>n.time)) + 1;
  arr[0].data = data;
  document.getElementById(`tabEditor_${tipo}`).value = JSON.stringify(arr,null,2);
  renderTablatureEditor(tipo, arr);
  setupTabs("E",tipo,true);
};
window.tabDelTime = function(tipo){
  let arr = JSON.parse(document.getElementById(`tabEditor_${tipo}`).value);
  let data = arr[0].data||[];
  let tiempos = Math.max(7, ...data.map(n=>n.time));
  arr[0].data = data.filter(n=>n.time < tiempos);
  document.getElementById(`tabEditor_${tipo}`).value = JSON.stringify(arr,null,2);
  renderTablatureEditor(tipo, arr);
  setupTabs("E",tipo,true);
};

// Dibuja el canvas de la tablatura, añade eventos para clics en las cuerdas/tiempos
function tabDrawCanvas(tipo, cuerdas, tiempos, data, arregloIdx){
  let canvas = document.getElementById(`tab-canvas-${tipo}`);
  if(!canvas) return;
  let W = (tiempos+1)*42;
  let H = cuerdas*34+44;
  // Creamos el grid de la tablatura
  let html = '';
  // Tiempos numerados arriba
  html += `<div style="display:flex;position:relative;">`;
  for(let t=0; t<=tiempos; t++) html += `<div class="tab-fret-num" style="left:${t*42}px;">${t+1}</div>`;
  html += `</div>`;
  // Cuerdas
  html += `<div style="position:relative;width:${W}px;height:${H-30}px">`;
  for(let s=0; s<cuerdas; s++) {
    let y = s*34+24;
    html += `<div style="position:absolute;left:0;top:${y}px;width:${W}px;height:3px;background:var(--pent-string);"></div>`;
  }
  // Líneas de tiempo
  for(let t=0; t<=tiempos; t++){
    html += `<div style="position:absolute;left:${t*42}px;top:16px;height:${cuerdas*34}px;width:2px;background:var(--pent-fret);"></div>`;
  }
  // Notas/arreglos
  data.forEach(note=>{
    let x = note.time*42+21;
    let y = note.cuerda*34+24;
    // Dot, flechas, muteo, bajeo, etc.
    if(note.tipo==="dot"){
      html += `<div class="tab-dot" style="left:${x}px;top:${y}px;" onclick="tabDeleteNote('${tipo}',${note.time},${note.cuerda})">${note.value}</div>`;
    }
    if(note.tipo==="flechaU"){
      html += `<svg class="tab-arrow" style="left:${x-14}px;top:${y-15}px;" onclick="tabDeleteNote('${tipo}',${note.time},${note.cuerda})" viewBox="0 0 32 14"><path d="M2 12 L16 2 L30 12" stroke="#2096ff" stroke-width="3" fill="none"/><path d="M16 2 L16 14" stroke="#2096ff" stroke-width="2"/></svg>`;
    }
    if(note.tipo==="flechaD"){
      html += `<svg class="tab-arrow" style="left:${x-14}px;top:${y-3}px;" onclick="tabDeleteNote('${tipo}',${note.time},${note.cuerda})" viewBox="0 0 32 14"><path d="M2 2 L16 12 L30 2" stroke="#6bb1de" stroke-width="3" fill="none"/><path d="M16 12 L16 0" stroke="#6bb1de" stroke-width="2"/></svg>`;
    }
    if(note.tipo==="muteo"){
      html += `<svg class="tab-mute" style="left:${x-10}px;top:${y-10}px;" onclick="tabDeleteNote('${tipo}',${note.time},${note.cuerda})" viewBox="0 0 24 18"><polyline points="3,15 12,3 21,15" stroke="#c91432" stroke-width="3" fill="none"/><polyline points="3,7 12,15 21,7" stroke="#c91432" stroke-width="3" fill="none"/></svg>`;
    }
    if(note.tipo==="bajeo"){
      html += `<span class="tab-bass" style="left:${x-9}px;top:${y-15}px;" onclick="tabDeleteNote('${tipo}',${note.time},${note.cuerda})">B</span>`;
    }
  }
  );
  // Clic en cuerda/tiempo para añadir nota
  for(let t=0; t<=tiempos; t++){
    for(let s=0; s<cuerdas; s++){
      let x = t*42+21;
      let y = s*34+24;
      html += `<div style="position:absolute;left:${x-16}px;top:${y-16}px;width:32px;height:32px;cursor:pointer;background:transparent;z-index:1" onclick="tabAddNotePrompt('${tipo}',${t},${s})"></div>`;
    }
  }
  html += `</div>`;
  canvas.innerHTML = html;
}
window.tabAddNotePrompt = function(tipo, time, cuerda){
  // Abre prompt para tipo de nota/arreglo: dot, flechaU, flechaD, muteo, bajeo
  let tipoNota = prompt("¿Qué deseas agregar?\n1 = dedo (1-4)\n2 = flecha arriba\n3 = flecha abajo\n4 = muteo\n5 = bajeo", "1");
  let arr = JSON.parse(document.getElementById(`tabEditor_${tipo}`).value);
  let data = arr[0].data||[];
  let note = null;
  if(tipoNota==="1"){
    let val = prompt("¿Número de dedo? (1-4 o traste para bandurria/laud):","1");
    if(!val) return;
    note = {time, cuerda, value: val, tipo:"dot"};
  }
  if(tipoNota==="2") note = {time, cuerda, value:"↑", tipo:"flechaU"};
  if(tipoNota==="3") note = {time, cuerda, value:"↓", tipo:"flechaD"};
  if(tipoNota==="4") note = {time, cuerda, value:"M", tipo:"muteo"};
  if(tipoNota==="5") note = {time, cuerda, value:"B", tipo:"bajeo"};
  if(note) data.push(note);
  arr[0].data = data;
  document.getElementById(`tabEditor_${tipo}`).value = JSON.stringify(arr,null,2);
  renderTablatureEditor(tipo, arr);
  setupTabs("E",tipo,true);
}
window.tabDeleteNote = function(tipo, time, cuerda){
  let arr = JSON.parse(document.getElementById(`tabEditor_${tipo}`).value);
  let data = arr[0].data||[];
  arr[0].data = data.filter(n=>!(n.time===time && n.cuerda===cuerda));
  document.getElementById(`tabEditor_${tipo}`).value = JSON.stringify(arr,null,2);
  renderTablatureEditor(tipo, arr);
  setupTabs("E",tipo,true);
};

// --- 10. Visor de tablaturas profesional ---
function renderTablatureViewer(tipo, arr){
  if(!arr || !arr.length) return "<em>No definido</em>";
  let cuerdas = 6;
  if(tipo==="mandolina"||tipo==="contrabajo") cuerdas = 4;
  let data = arr[0]?.data || [];
  let tiempos = Math.max(7, ...data.map(n=>n.time));
  let W = (tiempos+1)*42;
  let H = cuerdas*34+44;
  let html = '';
  html += `<div style="display:flex;position:relative;">`;
  for(let t=0; t<=tiempos; t++) html += `<div class="tab-fret-num" style="left:${t*42}px;">${t+1}</div>`;
  html += `</div>`;
  html += `<div style="position:relative;width:${W}px;height:${H-30}px">`;
  for(let s=0; s<cuerdas; s++) {
    let y = s*34+24;
    html += `<div style="position:absolute;left:0;top:${y}px;width:${W}px;height:3px;background:var(--pent-string);"></div>`;
  }
  for(let t=0; t<=tiempos; t++){
    html += `<div style="position:absolute;left:${t*42}px;top:16px;height:${cuerdas*34}px;width:2px;background:var(--pent-fret);"></div>`;
  }
  data.forEach(note=>{
    let x = note.time*42+21;
    let y = note.cuerda*34+24;
    if(note.tipo==="dot"){
      html += `<div class="tab-dot" style="left:${x}px;top:${y}px;">${note.value}</div>`;
    }
    if(note.tipo==="flechaU"){
      html += `<svg class="tab-arrow" style="left:${x-14}px;top:${y-15}px;" viewBox="0 0 32 14"><path d="M2 12 L16 2 L30 12" stroke="#2096ff" stroke-width="3" fill="none"/><path d="M16 2 L16 14" stroke="#2096ff" stroke-width="2"/></svg>`;
    }
    if(note.tipo==="flechaD"){
      html += `<svg class="tab-arrow" style="left:${x-14}px;top:${y-3}px;" viewBox="0 0 32 14"><path d="M2 2 L16 12 L30 2" stroke="#6bb1de" stroke-width="3" fill="none"/><path d="M16 12 L16 0" stroke="#6bb1de" stroke-width="2"/></svg>`;
    }
    if(note.tipo==="muteo"){
      html += `<svg class="tab-mute" style="left:${x-10}px;top:${y-10}px;" viewBox="0 0 24 18"><polyline points="3,15 12,3 21,15" stroke="#c91432" stroke-width="3" fill="none"/><polyline points="3,7 12,15 21,7" stroke="#c91432" stroke-width="3" fill="none"/></svg>`;
    }
    if(note.tipo==="bajeo"){
      html += `<span class="tab-bass" style="left:${x-9}px;top:${y-15}px;">B</span>`;
    }
  });
  html += `</div>`;
  return `<div class="tablature">${html}</div>`;
}

// --- 11. PDF (descarga de la canción) ---
window.downloadPDF = async function(id){
  const docRef = await db.collection("songs").doc(id).get();
  const d = docRef.data();
  const pdf = new window.jspdf.jsPDF();
  let y = 12;
  pdf.setFont("helvetica","bold"); pdf.text(d.title||"", 12, y);
  y+=10; pdf.setFont("helvetica","normal");
  pdf.text("Letra:",12,y); y+=6;
  pdf.setFontSize(11); pdf.text((d.letra||"").substring(0,1400), 16, y); y+=28;
  pdf.setFontSize(10);
  if(d.letraAcordes?.length){
    pdf.text("Letra con acordes:",12,y); y+=6;
    d.letraAcordes.forEach(line=>{
      pdf.text(line.map(p=>p.acorde||" ").join(" "),16,y); y+=4;
      pdf.text(line.map(p=>p.char).join(" "),16,y); y+=6;
    });
    y+=4;
  }
  ["guitarra","mandolina","bandurria","laud","contrabajo","guitarron"].forEach(inst=>{
    if(d[inst]?.length){
      pdf.text(inst.charAt(0).toUpperCase()+inst.slice(1)+":",12,y); y+=5;
      pdf.text("Ver tablatura visual en la web", 16, y); y+=7;
    }
  });
  pdf.save(`${d.title||"cancion"}.pdf`);
}

// --- 12. Ensayo en vivo ---
window.startLivePractice = async function(id){
  const doc = await db.collection("songs").doc(id).get();
  const d = doc.data();
  let letraArr = d.letraAcordes || [];
  let speed = 450; // ms por letra
  document.getElementById('songView').innerHTML = `
    <div class="mt-2">
      <h3>${d.title}</h3>
      <div style="margin:1em 0">
        <button class="btn" onclick="window.stopLivePractice=true;">Detener</button>
        <label style="margin-left:1em;font-size:.95em">Velocidad:</label>
        <input id="speedSlider" type="range" min="100" max="1000" step="50" value="${speed}" style="vertical-align:middle;width:120px;">
      </div>
      <div id="livePracticeBox" style="margin:2em 0;min-height:110px"></div>
    </div>
  `;
  let box = document.getElementById("livePracticeBox");
  document.getElementById("speedSlider").oninput = e=>{speed = e.target.value;}
  window.stopLivePractice = false;
  let i = 0;
  async function showLine(i){
    if(window.stopLivePractice) return;
    box.innerHTML = renderAcordesViewer([letraArr[i]]);
    await new Promise(res=>setTimeout(res,speed));
    if(i<letraArr.length-1) showLine(i+1);
  }
  showLine(0);
}
// --- 13. Inicialización, autenticación y helpers globales ---
auth.onAuthStateChanged(user=>{
  currentUser = user;
  if(user) renderHome();
  else showLoginForm();
});

// --- 14. Helpers para globales (por onclick) ---
window.renderSongEditor = renderSongEditor;
window.renderSongView = renderSongView;

// --- FIN ---
