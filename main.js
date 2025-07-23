// main.js

// --- Firebase Config ---
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

const root = document.getElementById('root');

// --- Render Header ---
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

// --- Login / Logout ---
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

// --- Render Home (Canciones) ---
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

// --- Song Viewer ---
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

// --- Song Editor (admin only) ---
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
  window.formDraft = Object.assign({}, data);

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
  setupTabs("E","letra",true); // Arranca en Letra

  // Save/Edit logic
  document.getElementById('songEditForm').onsubmit = async e=>{
    e.preventDefault();
    const f = e.target;
    // Antes de guardar, sincroniza el draft con los campos actuales
    syncTabDraft(currentTabE());
    window.formDraft.title = f.title.value;
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

  // Autoguardado
  if(autoSaveInterval) clearInterval(autoSaveInterval);
  autoSaveInterval = setInterval(()=>{
    syncTabDraft(currentTabE());
    localStorage.setItem('edis_autosave_'+(id||'new'), JSON.stringify(window.formDraft));
  },20000);
}

// Guarda lo editado del tab activo en formDraft
function syncTabDraft(tab){
  if(!window.formDraft) return;
  // Title
  let t = document.getElementById("field_title");
  if(t) window.formDraft.title = t.value;
  // Los tabs editables
  if(tab === "letra") window.formDraft.letra = document.getElementById("field_letra")?.value||"";
  if(tab === "letraAcordes"){
    // Reconstruye letraAcordes desde textarea acordes
    let linesL = (document.getElementById("acordesLetra")?.value||"").split("\n");
    let linesA = (document.getElementById("acordesAcordes")?.value||"").split("\n");
    let arr = [];
    for(let i=0;i<linesL.length;i++){
      let chars = linesL[i].split('');
      let acordes = (linesA[i]||"").split('\t');
      arr.push(chars.map((c,j)=>({char:c,acorde:acordes[j]||""})));
    }
    window.formDraft.letraAcordes = arr;
  }
  ["guitarra","mandolina","bandurria","laud","contrabajo","guitarron"].forEach(tipo=>{
    if(tab === tipo){
      let val = document.getElementById(`tabEditor_${tipo}`)?.value||"";
      try { window.formDraft[tipo] = JSON.parse(val); } catch{ window.formDraft[tipo]=[]; }
    }
  });
}

// Manejo de tabs del editor y visor
function setupTabs(mode, initTab, isEdit){
  let container = document.getElementById('tabContent'+mode);
  const tabIds = ["letra","letraAcordes","guitarra","mandolina","bandurria","laud","contrabajo","guitarron"];
  let currentTab = initTab||tabIds[0];
  window.currentTabE = ()=>currentTab;
  function show(tab){
    // Si es edición, guarda el draft antes de cambiar
    if(isEdit) syncTabDraft(currentTab);
    currentTab = tab;
    document.querySelectorAll("#tabs"+mode+" .tab").forEach(el=>el.classList.remove("active"));
    document.querySelector(`#tabs${mode} .tab[data-tab=${tab}]`).classList.add("active");
    let data = (isEdit && window.formDraft) ? window.formDraft : undefined;
    container.innerHTML = getTabContent(tab,data||{},isEdit,mode);
  }
  document.querySelectorAll("#tabs"+mode+" .tab").forEach(btn=>{
    btn.onclick = (e)=>{ e.preventDefault(); show(btn.dataset.tab);}
  });
  show(currentTab);
}

function getTabContent(tab, data, isEdit, mode){
  // ---- Letra ----
  if(tab==="letra") {
    if(isEdit){
      return `<textarea rows="9" id="field_letra" placeholder="Letra simple">${data.letra||''}</textarea>`;
    } else {
      return `<pre style="white-space:pre-wrap;font-size:1.1em">${data.letra||'<em>No definida</em>'}</pre>`;
    }
  }
  // ---- Letra con Acordes ----
  if(tab==="letraAcordes") {
    if(isEdit){
      // Si no hay letraAcordes, lo mapeamos automáticamente desde la letra principal
      let base = [];
      if (data.letraAcordes && data.letraAcordes.length > 0) {
        base = data.letraAcordes;
      } else if (data.letra) {
        // Mapeo automático: cada línea, cada carácter
        base = data.letra.split("\n").map(line =>
          line.split('').map(c => ({ char: c, acorde: "" }))
        );
      }
      return `
        <div>
          <p style="font-size:.93em;color:var(--primary)">
            La letra se toma directamente de la pestaña "Letra".<br>
            Escribe los acordes justo encima de cada letra, dejando vacío donde no hay acorde.
          </p>
          <div id="acordesEditor">${renderAcordesEditor(base)}</div>
        </div>
      `;
    } else {
      let ac = data.letraAcordes || [];
      if(!ac.length) return "<em>No definido</em>";
      return renderAcordesViewer(ac);
    }
  }
  // ---- Instrumentos ----
  if(["guitarra","mandolina","bandurria","laud","contrabajo","guitarron"].includes(tab)){
    if(isEdit){
      return renderTablatureEditor(tab, data[tab]||[]);
    } else {
      return renderTablatureViewer(tab, data[tab]||[]);
    }
  }
  return `<div>No implementado aún.</div>`;
}

// ----------- Letra con acordes -----------
// Editor
function renderAcordesEditor(base){
  let letra = base.map(line=>line.map(pair=>pair.char).join("")).join("\n");
  let acordes = base.map(line=>line.map(pair=>pair.acorde||"").join("\t")).join("\n");
  return `
    <textarea rows="7" id="acordesLetra" disabled style="background:#f5f5f5">${letra}</textarea>
    <textarea rows="7" id="acordesAcordes" placeholder="Acordes (uno por caracter, separar tabs para acordes en blanco)...">${acordes}</textarea>
    <p style="font-size:.95em;color:#6bb1de;margin:5px 0">
      La letra viene directamente de la pestaña "Letra".<br>
      Solo escribe acordes alineados con cada letra.
    </p>
  `;
}
function getFieldValue(tab){
  if(tab==="letraAcordes"){
    let linesL = (document.getElementById("acordesLetra").value||"").split("\n");
    let linesA = (document.getElementById("acordesAcordes").value||"").split("\n");
    let arr = [];
    for(let i=0;i<linesL.length;i++){
      let chars = linesL[i].split('');
      let acordes = (linesA[i]||"").split('\t');
      arr.push(chars.map((c,j)=>({char:c,acorde:acordes[j]||""})));
    }
    return arr;
  }
  if(tab==="letra") return document.getElementById("field_letra").value;
  if(["guitarra","mandolina","bandurria","laud","contrabajo","guitarron"].includes(tab)){
    let json = document.getElementById(`tabEditor_${tab}`).value;
    try { return JSON.parse(json); } catch{ return []; }
  }
  return "";
}
// Visor
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

// --------------- Tablatura Editor/Viewer ---------------
function renderTablatureEditor(tipo, arr){
  let json = JSON.stringify(arr||[],null,2);
  return `
    <textarea rows="8" id="tabEditor_${tipo}" placeholder="Estructura JSON (arreglo de arreglos con notas)">
${json}
</textarea>
    <p style="font-size:.93em;color:#888;">(En el futuro esto será un editor gráfico. Por ahora puedes editar el arreglo JSON.)</p>
    <div style="overflow-x:auto;">${renderTablatureViewer(tipo, arr)}</div>
  `;
}
function renderTablatureViewer(tipo, arr){
  if(!arr || !arr.length) return "<em>No definido</em>";
  let data = arr[0]?.data || [];
  let cuerdas = 6;
  if(tipo==="mandolina"||tipo==="contrabajo") cuerdas = 4;
  let tiempos = Math.max(...data.map(n=>n.time))+1||8;
  let frets = cuerdas===6?6:0;
  let out = `<div class="tablature"><div class="tab-strings" style="height:${cuerdas*28}px;width:${tiempos*42}px;position:relative">`;
  for(let s=0;s<cuerdas;s++){
    out+=`<div class="tab-row" style="top:${s*28}px;position:absolute;width:100%"><div class="tab-string" style="top:50%"></div></div>`;
  }
  for(let t=0;t<tiempos;t++){
    out+=`<div class="tab-fret" style="left:${t*42}px;height:${cuerdas*28}px"></div>`;
  }
  data.forEach(n=>{
    let y = n.cuerda*28+14;
    let x = n.time*42+21;
    out += `<div class="tab-circle" style="top:${y}px;left:${x}px">${n.value}</div>`;
  });
  out += `</div></div>`;
  return out;
}

// ----------- PDF Download -----------
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
      pdf.text("Arreglos no visualizables en PDF (ver en la web)", 16, y); y+=7;
    }
  });
  pdf.save(`${d.title||"cancion"}.pdf`);
}

// -------- Ensayo en vivo ----------
window.startLivePractice = async function(id){
  const doc = await db.collection("songs").doc(id).get();
  const d = doc.data();
  let letraArr = d.letraAcordes || [];
  let pos = 0;
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
  async function showLine(i){
    if(window.stopLivePractice) return;
    box.innerHTML = renderAcordesViewer([letraArr[i]]);
    box.querySelectorAll("div > div:nth-child(2) > span")[pos]?.classList.add("scroll-anim");
    await new Promise(res=>setTimeout(res,speed));
    if(i<letraArr.length-1) showLine(i+1);
  }
  showLine(0);
}

// --- INICIALIZAR ---
auth.onAuthStateChanged(user=>{
  currentUser = user;
  if(user) renderHome();
  else showLoginForm();
});

// --------- Helpers para globales (por onclick) ---------
window.renderSongEditor = renderSongEditor;
window.renderSongView = renderSongView;
