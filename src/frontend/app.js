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
const STREAK_KEY = "productivityStreak";
const LAST_COMPLETION_KEY = "lastCompletionDate";
const THEME_COLOR_KEY = "themeColor";

// Thèmes de couleur disponibles
const COLOR_THEMES = {
  purple: { primary: '#6366f1', secondary: '#818cf8', name: '💜 Purple' },
  blue: { primary: '#3b82f6', secondary: '#60a5fa', name: '💙 Blue' },
  pink: { primary: '#ec4899', secondary: '#f472b6', name: '💗 Pink' },
  green: { primary: '#10b981', secondary: '#34d399', name: '💚 Green' },
  orange: { primary: '#f59e0b', secondary: '#fbbf24', name: '🧡 Orange' },
};

let currentFilter = 'all'; // all, pending, inprogress, done

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

// --- Streak Management ---
function getStreak() {
  return parseInt(localStorage.getItem(STREAK_KEY) || "0", 10);
}
function updateStreak() {
  const lastDate = localStorage.getItem(LAST_COMPLETION_KEY);
  const today = new Date().toDateString();
  
  if (!lastDate) {
    localStorage.setItem(STREAK_KEY, "1");
    localStorage.setItem(LAST_COMPLETION_KEY, today);
    return 1;
  }
  
  const last = new Date(lastDate);
  const now = new Date();
  const diffDays = Math.floor((now - last) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return getStreak();
  } else if (diffDays === 1) {
    const newStreak = getStreak() + 1;
    localStorage.setItem(STREAK_KEY, String(newStreak));
    localStorage.setItem(LAST_COMPLETION_KEY, today);
    return newStreak;
  } else {
    localStorage.setItem(STREAK_KEY, "1");
    localStorage.setItem(LAST_COMPLETION_KEY, today);
    return 1;
  }
}

// --- Theme Management ---
function getThemeColor() {
  return localStorage.getItem(THEME_COLOR_KEY) || 'purple';
}
function setThemeColor(colorName) {
  localStorage.setItem(THEME_COLOR_KEY, colorName);
  applyThemeColor(colorName);
}
function applyThemeColor(colorName) {
  const theme = COLOR_THEMES[colorName];
  if (!theme) return;
  
  document.documentElement.style.setProperty('--primary', theme.primary);
  document.documentElement.style.setProperty('--primary-hover', theme.primary);
  document.documentElement.style.setProperty('--secondary', theme.secondary);
}

// --- Initialisation ---
$(document).ready(function () {
  // Appliquer le thème sauvegardé
  applyThemeColor(getThemeColor());
  updateStreakDisplay();
  
  loadTasks();

  // Raccourcis clavier
  $(document).on('keydown', function(e) {
    // Ctrl/Cmd + N = Nouvelle tâche
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      $('#todo-input').focus();
    }
    // Ctrl/Cmd + K = Toggle dark mode
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      $('#theme-toggle').click();
    }
  });

  // Filtres
  $('.filter-btn').on('click', function() {
    $('.filter-btn').removeClass('active');
    $(this).addClass('active');
    currentFilter = $(this).data('filter');
    filterTasks();
  });

  // Sélecteur de couleur
  $('.color-option').on('click', function() {
    $('.color-option').removeClass('active');
    $(this).addClass('active');
    const colorName = $(this).data('color');
    setThemeColor(colorName);
  });

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
      // Animation success
      showNotification("✅ Tâche ajoutée !");
    } catch (error) {
      console.error("Erreur ajout :", error);
      showNotification("❌ Erreur lors de l'ajout");
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
      
      // Si tâche complétée, mettre à jour le streak
      if (newStatus === STATUS.DONE) {
        const newStreak = updateStreak();
        updateStreakDisplay();
        if (newStreak > 1) {
          showNotification(`🔥 Streak de ${newStreak} jours !`);
        }
      }
      
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
  
  // Mise à jour de la barre de progression générale
  updateOverallProgress(completedPercent);
}

// Barre de progression générale
function updateOverallProgress(percent) {
  const $progressBar = $('.overall-progress-fill');
  const $progressText = $('.overall-progress-text');
  
  $progressBar.css('width', percent + '%');
  $progressText.text(Math.round(percent) + '%');
  
  // Changer la couleur selon la progression
  $progressBar.removeClass('low medium high');
  if (percent < 33) $progressBar.addClass('low');
  else if (percent < 66) $progressBar.addClass('medium');
  else $progressBar.addClass('high');
}

// Filtrer les tâches
function filterTasks() {
  $('#todo-list li').each(function() {
    const $li = $(this);
    const status = $li.find('.status-select').val();
    
    let show = false;
    if (currentFilter === 'all') show = true;
    else if (currentFilter === 'pending' && status === STATUS.PENDING) show = true;
    else if (currentFilter === 'inprogress' && status === STATUS.INPROGRESS) show = true;
    else if (currentFilter === 'done' && status === STATUS.DONE) show = true;
    
    if (show) {
      $li.slideDown(200);
    } else {
      $li.slideUp(200);
    }
  });
}

// Afficher une notification toast
function showNotification(message) {
  const $notification = $('<div class="toast-notification"></div>').text(message);
  $('body').append($notification);
  
  setTimeout(() => $notification.addClass('show'), 10);
  setTimeout(() => {
    $notification.removeClass('show');
    setTimeout(() => $notification.remove(), 300);
  }, 2000);
}

// Mettre à jour l'affichage du streak
function updateStreakDisplay() {
  const streak = getStreak();
  $('#streak-count').text(streak);
  
  // Animation du feu si streak > 3
  if (streak >= 3) {
    $('#streak-count').addClass('on-fire');
  } else {
    $('#streak-count').removeClass('on-fire');
  }
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
const secretBtn = document.getElementById("secret-btn");

let secretRevealed = false;

countryBtn.addEventListener("mouseenter", () => {
  earth.classList.add("active");
  // Montrer le bouton secret quand la Terre apparaît
  secretBtn.classList.add("visible");
  secretRevealed = true;
});

countryBtn.addEventListener("mouseleave", () => {
  earth.classList.remove("active");
  // NE PAS cacher le bouton secret - il reste visible une fois révélé !
  // secretBtn.classList.remove("visible");
});

// ========================= EASTER EGG: DESTROY EARTH =========================
const destroyBtn = document.getElementById("destroy-btn");
const countdownOverlay = document.getElementById("countdown-overlay");
const countdownNumber = document.getElementById("countdown-number");

let destroySequenceActive = false;

// Étape 1: Clic sur le bouton secret
secretBtn.addEventListener("click", () => {
  if (destroySequenceActive) return;
  destroySequenceActive = true;
  
  // Cacher le bouton secret
  secretBtn.classList.remove("visible");
  
  // Faire descendre toutes les cartes
  document.body.classList.add("destroyed");
  
  // Zoomer sur la Terre
  earth.classList.add("zoomed");
  
  // Après 1 seconde, montrer le bouton "Destroy Earth"
  setTimeout(() => {
    destroyBtn.classList.add("visible");
  }, 1000);
});

// Étape 2: Clic sur "Destroy Earth"
destroyBtn.addEventListener("click", () => {
  // Cacher le bouton destroy
  destroyBtn.classList.remove("visible");
  
  // Afficher l'overlay de compte à rebours
  countdownOverlay.classList.add("active");
  
  // Démarrer le compte à rebours
  let count = 10;
  countdownNumber.textContent = count;
  
  const countdownInterval = setInterval(() => {
    count--;
    countdownNumber.textContent = count;
    
    // Animation de pulse à chaque nombre
    countdownNumber.style.animation = "none";
    setTimeout(() => {
      countdownNumber.style.animation = "countdownPulse 1s ease-in-out";
    }, 10);
    
    // Commencer le flash rouge à partir de 3
    if (count <= 3) {
      countdownOverlay.classList.add("flashing");
    }
    
    if (count === 0) {
      clearInterval(countdownInterval);
      
      // EXPLOSION!
      setTimeout(() => {
        createExplosion();
      }, 500);
    }
  }, 1000);
});

function createExplosion() {
  // Créer plusieurs explosions pour un effet plus spectaculaire
  const explosionCount = 5;
  
  for (let i = 0; i < explosionCount; i++) {
    setTimeout(() => {
      const explosion = document.createElement("div");
      explosion.className = "explosion";
      
      // Positionner aléatoirement autour du centre
      const offsetX = (Math.random() - 0.5) * 200;
      const offsetY = (Math.random() - 0.5) / 200;
      explosion.style.left = `calc(50% + ${offsetX}px)`;
      explosion.style.top = `calc(50% + ${offsetY}px)`;
      
      document.body.appendChild(explosion);
      
      // Retirer l'explosion après l'animation
      setTimeout(() => {
        explosion.remove();
      }, 1500);
    }, i * 150);
  }
  
  // Faire disparaître tout après l'explosion
  setTimeout(() => {
    countdownOverlay.style.background = "white";
    document.body.style.background = "white";
    
    // Message final
    setTimeout(() => {
      countdownOverlay.innerHTML = `
        <div style="text-align: center; color: #1f2937;">
          <h1 style="font-size: 4rem; margin-bottom: 20px;">💥 BOOM! 💥</h1>
          <p style="font-size: 1.5rem; margin-bottom: 30px;">La Terre a été détruite...</p>
          <button onclick="location.reload()" style="
            padding: 15px 40px;
            font-size: 1.2rem;
            background: #6366f1;
            color: white;
            border: none;
            border-radius: 12px;
            cursor: pointer;
            font-weight: 600;
          ">Recommencer 🔄</button>
        </div>
      `;
    }, 1000);
  }, 1500);
}