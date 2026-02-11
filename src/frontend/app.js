const apiEndpoint = "https://backend-app.blacksky-de1cc0f5.northeurope.azurecontainerapps.io/api/tasks";
const countCountriesEndpoint = "https://compteurpays-b7gdb3cafscrf3bw.northeurope-01.azurewebsites.net/api/ComptagePays";

$(document).ready(function () {

  loadTasks();

  // ADD TASK
  $("#todo-form").on("submit", async function (e) {
    e.preventDefault();

    const description = $("#todo-input").val().trim();
    if (!description) return;

    try {
      await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description })
      });

      $("#todo-input").val("");
      loadTasks();
    } catch (error) {
      console.error("Erreur ajout :", error);
    }
  });

  // TOGGLE
  $("#todo-list").on("change", ".task-toggle", async function () {
    const li = $(this).closest("li");
    const id = li.data("id");
    const description = li.find(".task-text").text();
    const completed = $(this).is(":checked");

    try {
      await fetch(apiEndpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, description, completed })
      });

      loadTasks();
    } catch (error) {
      console.error("Erreur update :", error);
    }
  });

  // DELETE
  $("#todo-list").on("click", ".delete-btn", async function () {
    const id = $(this).closest("li").data("id");

    try {
      await fetch(`${apiEndpoint}?id=${id}`, {
        method: "DELETE"
      });

      loadTasks();
    } catch (error) {
      console.error("Erreur delete :", error);
    }
  });

});


/* =========================
   LOAD TASKS + STATS
========================= */
async function loadTasks() {
  try {
    const response = await fetch(apiEndpoint);
    const tasks = await response.json();

    tasks.sort((a, b) => a.completed - b.completed);

    $("#todo-list").empty();

    tasks.forEach(task => {
      const li = $(`
        <li class="${task.completed ? "completed" : ""}" data-id="${task.id}">
          <div style="display:flex;align-items:center;gap:10px;">
            <input type="checkbox" class="task-toggle" ${task.completed ? "checked" : ""}>
            <span class="task-text">${task.description}</span>
          </div>
          <button class="delete-btn">✕</button>
        </li>
      `);

      $("#todo-list").append(li);
    });

    updateStats(tasks);

  } catch (error) {
    console.error("Erreur chargement :", error);
  }
}


/* =========================
   STATS + PROGRESS
========================= */
function updateStats(tasks) {
  const total = tasks.length;
  const completed = tasks.filter(t => t.completed).length;

  $("#total-tasks").text(total);
  $("#completed-tasks").text(completed);

  const percent = total ? (completed / total) * 100 : 0;
  $(".progress-fill").css("width", percent + "%");
}


/* =========================
   DARK MODE
========================= */
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


/* =========================
   COUNTRIES
========================= */
$("#count-countries-btn").on("click", async function () {
  $("#countries-result").text("⏳ Chargement...");

  try {
    const response = await fetch(countCountriesEndpoint);
    const data = await response.json();

    $("#countries-result").text(
      `🌍 Nombre de pays : ${data.totalCountries}`
    );
  } catch (error) {
    $("#countries-result").text("❌ Erreur");
  }
});

// FADE-IN / FADE-OUT EARTH ON HOVER
const earth = document.getElementById('earth-bg');
const countryBtn = document.getElementById('count-countries-btn');

countryBtn.addEventListener('mouseenter', () => {
  earth.classList.add('active');
});

countryBtn.addEventListener('mouseleave', () => {
  earth.classList.remove('active');
});
