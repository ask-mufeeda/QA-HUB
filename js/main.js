import { supabase } from "./supabase.js";

// HTML ELEMENTS
const navigation = document.getElementById("navigation");
const pageTitle = document.getElementById("pageTitle");
const userInfo = document.getElementById("userInfo");
const message = document.getElementById("message");
const logoutBtn = document.getElementById("logoutBtn");

// CHECK LOGIN
async function startApp() {

    const { data: { session }, error } =
        await supabase.auth.getSession();

    if (error || !session) {
        window.location.replace("login.html");
        return;
    }

    const user = session.user;

    // GET USER ROLE
    const { data: profile, error: profileError } =
        await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .maybeSingle();

    if (profileError || !profile) {
        message.textContent = "Unable to verify your account role.";
        return;
    }

    const role = String(profile.role)
        .trim()
        .toLowerCase();

    userInfo.textContent =
        "Logged in as: " + user.email + " | Role: " + role;

    pageTitle.textContent =
        "Welcome to QA Hub";

    // ROLE-BASED NAVIGATION
    let modules = [];

    if (role === "tester") {

        modules = [
            ["Dashboard", "dashboard.html"],
            ["Bug Tracking", "bugs.html"],
            ["API Testing", "api-testing.html"],
            ["SQL Practice", "sql-practice.html"],
            ["Manual Testing", "manual-testing.html"],
            ["Learning Resources", "resources.html"]
        ];

    }

    else if (role === "developer") {

        modules = [
            ["Developer Dashboard", "developer-dashboard.html"]
        ];

    }

    else if (role === "admin") {

        modules = [
            ["Admin Dashboard", "admin.html"],
            ["Bug Tracking", "bugs.html"]
        ];

    }

    else {
        message.textContent = "Unknown account role.";
        return;
    }

    // CREATE NAVIGATION BUTTONS
    navigation.innerHTML = "";

    modules.forEach(([name, file]) => {

        const button = document.createElement("button");

        button.textContent = name;

        button.addEventListener("click", () => {
            window.location.href = file;
        });

        navigation.appendChild(button);

    });

}

// LOGOUT
logoutBtn.addEventListener("click", async () => {

    await supabase.auth.signOut();

    window.location.replace("login.html");

});

// START APPLICATION
startApp();