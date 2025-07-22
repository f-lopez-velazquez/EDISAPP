import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDtShAFym0sPrrkocsY48oAB2W4wbUD9ZY",
  authDomain: "edisapp-54c5c.firebaseapp.com",
  projectId: "edisapp-54c5c",
  storageBucket: "edisapp-54c5c.appspot.com",
  messagingSenderId: "1022245708836",
  appId: "1:1022245708836:web:5031161ed56f7d162524b1"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const myForm = document.getElementById("my-form");
const txt = document.getElementById("txt");
const lista = document.getElementById("lista");

// Guardar texto en Firestore
myForm.onsubmit = async (e) => {
  e.preventDefault();
  const value = txt.value.trim();
  if(!value) return;
  await addDoc(collection(db,"demo_textos"), { texto: value, fecha: new Date() });
  txt.value = "";
  txt.focus();
};

// Mostrar la lista en tiempo real
onSnapshot(collection(db,"demo_textos"), (snap) => {
  lista.innerHTML = "";
  let arr = [];
  snap.forEach(doc => arr.push(doc.data().texto));
  arr.forEach(texto => {
    let li = document.createElement("li");
    li.textContent = texto;
    lista.appendChild(li);
  });
});

console.log("demo.js cargado correctamente");
