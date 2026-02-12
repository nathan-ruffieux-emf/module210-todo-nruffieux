// --- Endpoints (inchangés) ---
const apiEndpoint =
  "https://backend-app.blacksky-de1cc0f5.northeurope.azurecontainerapps.io/api/tasks";
const countCountriesEndpoint =
  "https://compteurpays-b7gdb3cafscrf3bw.northeurope-01.azurewebsites.net/api/ComptagePays";

// --- Constantes front pour les états ---
const STATUS = {
  PENDING: "en attente",
  INPROGRESS: "en cours",
  DONE: "finie",
};
const STATUS_KEY = "taskStatusMap";
const DELETED_KEY = "deletedCount";

// --- Helpers LocalStorage ---
function getStatusMap() {
  try {
    return JSON.parse(localStorage.getItem(STATUS_KEY)) || {};
  } catch {
    return {};
  }
}
function setStatusMap(map) {
  localStorage.setItem(STATUS_KEY, JSON.stringify(map));
}
function getTaskStatus(task) {
  const map = getStatusMap();
  // Si le backend dit "completed", on force 'finie'
  if (task.completed) {
    if (map[task.id] !== STATUS.DONE) {
      map[task.id] = STATUS.DONE;
      setStatusMap(map);
    }
    return STATUS.DONE;
  }
  // Sinon on lit la préférence locale (défaut "en attente")
  if (!map[task.id]) {
    map[task.id] = STATUS.PENDING;
    setStatusMap(map);
  }
  return map[task.id];
}
function setTaskStatus(id, status) {
  const map = getStatusMap();
  map[id] = status;
  setStatusMap(map);
}
function removeTaskStatus(id) {
  const map = getStatusMap();
  if (id in map) {
    delete map[id];
    setStatusMap(map);
  }
}
function getDeletedCount() {
  return parseInt(localStorage.getItem(DELETED_KEY) || "0", 10);
}
function incDeletedCount() {
  localStorage.setItem(DELETED_KEY, String(getDeletedCount() + 1));
}

// --- Initialisation ---
$(document).ready(function () {
  loadTasks();

  // Ajouter une tâche
  $("#todo-form").on("submit", async function (e) {
    e.preventDefault();
    const description = $("#todo-input").val().trim();
    if (!description) return;
    try {
      await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      $("#todo-input").val("");
      loadTasks();
    } catch (error) {
      console.error("Erreur ajout :", error);
    }
  });

  // Changer l'état (select)
  $("#todo-list").on("change", ".status-select", async function () {
    const li = $(this).closest("li");
    const id = li.data("id");
    const description = li.find(".task-text").text();
    const newStatus = $(this).val();

    // Mise à jour backend (completed) selon l'état choisi
    const completed = newStatus === STATUS.DONE;

    try {
      await fetch(apiEndpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, description, completed }),
      });

      // MàJ statut local + classes visuelles
      setTaskStatus(id, newStatus);
      applyStatusClasses(li, newStatus);
      // Rafraîchir stats (moins coûteux que recharger toute la liste)
      refreshCountersOnly();
    } catch (error) {
      console.error("Erreur update :", error);
    }
  });

  // Supprimer une tâche
  $("#todo-list").on("click", ".delete-btn", async function () {
    const id = $(this).closest("li").data("id");
    try {
      await fetch(`${apiEndpoint}?id=${id}`, { method: "DELETE" });
      incDeletedCount();
      removeTaskStatus(id);
      loadTasks();
    } catch (error) {
      console.error("Erreur delete :", error);
    }
  });
});

// ========================= LOAD TASKS + RENDU =========================
async function loadTasks() {
  try {
    const response = await fetch(apiEndpoint);
    const tasks = await response.json();

    // Tri : non finies d'abord (comme avant)
    tasks.sort((a, b) => a.completed - b.completed);

    $("#todo-list").empty();

    tasks.forEach((task) => {
      const status = getTaskStatus(task);
      const li = $(`
        <li data-id="${task.id}">
          <div class="left">
            <select class="status-select" aria-label="État de la tâche">
              <option value="${STATUS.PENDING}">En attente</option>
              <option value="${STATUS.INPROGRESS}">En cours</option>
              <option value="${STATUS.DONE}">Finie</option>
            </select>
            <span class="task-text">${task.description}</span>
          </div>
          <button class="delete-btn" title="Supprimer">✕</button>
        </li>
      `);

      li.find(".status-select").val(status);
      applyStatusClasses(li, status);

      $("#todo-list").append(li);
    });

    updateStats(tasks);
  } catch (error) {
    console.error("Erreur chargement :", error);
  }
}

// Applique les classes visuelles selon l'état
function applyStatusClasses($li, status) {
  $li.removeClass("status-pending status-inprogress status-done completed");
  if (status === STATUS.PENDING) {
    $li.addClass("status-pending");
  } else if (status === STATUS.INPROGRESS) {
    $li.addClass("status-inprogress");
  } else if (status === STATUS.DONE) {
    $li.addClass("status-done completed"); // conserve le style 'completed' existant
  }
}

// ========================= STATS + PROGRESS =========================
function updateStats(tasks) {
  const total = tasks.length;

  // Calcule les états effectifs (backend + localStorage)
  let completedCount = 0;
  let inProgressCount = 0;

  tasks.forEach((t) => {
    const st = getTaskStatus(t);
    if (st === STATUS.DONE || t.completed) completedCount += 1;
    if (st === STATUS.INPROGRESS) inProgressCount += 1;
  });

  $("#total-tasks").text(total);
  $("#completed-tasks").text(completedCount);
  $("#inprogress-tasks").text(inProgressCount);
  $("#deleted-tasks").text(getDeletedCount());

  // Calcul des pourcentages individuels
  const completedPercent = total ? (completedCount / total) * 100 : 0;
  const inProgressPercent = total ? (inProgressCount / total) * 100 : 0;

  // Mise à jour du cercle "Finies"
  updateProgressCircle($("#completed-tasks").closest(".stat-card").find(".progress-ring__circle"), completedPercent);
  
  // Mise à jour du cercle "En cours"
  updateProgressCircle($("#inprogress-tasks").closest(".stat-card").find(".progress-ring__circle"), inProgressPercent);
}

// Helper pour mettre à jour un cercle de progression
function updateProgressCircle($circle, percent) {
  if ($circle.length === 0) return;
  const circle = $circle[0];
  const radius = circle.r.baseVal.value;
  const circumference = 2 * Math.PI * radius;
  circle.style.strokeDasharray = `${circumference} ${circumference}`;
  circle.style.strokeDashoffset = circumference;
  const offset = circumference - (percent / 100) * circumference;
  circle.style.strokeDashoffset = offset;
}

// Rafraîchit uniquement les compteurs (plus léger) après un changement de statut
async function refreshCountersOnly() {
  try {
    const response = await fetch(apiEndpoint);
    const tasks = await response.json();
    updateStats(tasks);
  } catch (e) {
    console.error("Erreur refresh counters :", e);
  }
}

// ========================= DARK MODE =========================
$("#theme-toggle").on("click", function () {
  $("body").toggleClass("dark");
  const isDark = $("body").hasClass("dark");
  $(this).text(isDark ? "☀️" : "🌙");
  localStorage.setItem("darkMode", isDark);
});

// Restore dark mode
if (localStorage.getItem("darkMode") === "true") {
  $("body").addClass("dark");
  $("#theme-toggle").text("☀️");
}

// ========================= COUNTRIES =========================
$("#count-countries-btn").on("click", async function () {
  $("#countries-result").text("⏳ Chargement...");
  try {
    const response = await fetch(countCountriesEndpoint);
    const data = await response.json();
    $("#countries-result").text(`🌍 Nombre de pays : ${data.totalCountries}`);
  } catch (error) {
    $("#countries-result").text("❌ Erreur");
  }
});

// Effet visuel Terre au survol
const earth = document.getElementById("earth-bg");
const countryBtn = document.getElementById("count-countries-btn");
countryBtn.addEventListener("mouseenter", () => {
  earth.classList.add("active");
});
countryBtn.addEventListener("mouseleave", () => {
  earth.classList.remove("active");
});