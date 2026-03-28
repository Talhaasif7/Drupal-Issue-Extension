import { supabase } from "../lib/supabase";

function injectTrackButton() {
  const projectHeader = document.querySelector(".field-name-title-field h1");
  if (!projectHeader) return;

  const projectName = window.location.pathname.split("/").pop();
  if (!projectName) return;

  // Avoid duplicate injection
  if (document.querySelector(".drupal-issue-tracker-btn")) return;

  const btn = document.createElement("button");
  btn.innerText = "Track with Supabase";
  btn.style.marginLeft = "20px";
  btn.style.padding = "6px 12px";
  btn.style.backgroundColor = "#3ecf8e"; // Supabase Green
  btn.style.color = "#121212";
  btn.style.fontWeight = "bold";
  btn.style.border = "none";
  btn.style.borderRadius = "4px";
  btn.style.cursor = "pointer";
  btn.style.fontSize = "12px";
  btn.className = "drupal-issue-tracker-btn";

  btn.onclick = async () => {
    btn.innerText = "Adding...";
    const { error } = await supabase
      .from('tracked_projects')
      .insert({ project_name: projectName });

    if (error) {
       if (error.code === '23505') { // Unique violation
         btn.innerText = "Already Tracked";
       } else {
         console.error(error);
         btn.innerText = "Error";
       }
    } else {
      btn.innerText = "Tracked ✓";
      btn.style.backgroundColor = "#10b981";
    }
  };

  projectHeader.appendChild(btn);
}

// Simple delay to ensure page elements are loaded
setTimeout(injectTrackButton, 1000);
