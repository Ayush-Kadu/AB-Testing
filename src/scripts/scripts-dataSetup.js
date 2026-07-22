function getCookie(name) {
    const cookies = document.cookie.split('; ');
    for (let cookie of cookies) {
        const [cookieName, cookieValue] = cookie.split('=');
        if (cookieName === name) {
            return cookieValue;
        }
    }
    return null;
}

function setCookie(name, value, days) {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + value + expires + "; path=/; Secure; SameSite=Lax";
}

function generateGAClientID() {
    return "GA1.1." + Math.floor(Math.random() * 1000000000) + "." + Math.floor(Date.now() / 1000);
}

function checkAndSetGAClientID() {
    let gaClientID = getCookie('_ga');
    if (!gaClientID) {
        gaClientID = generateGAClientID();
        setCookie('_ga', gaClientID, 365); // Set for 1 year
        console.log("New _ga cookie set:", gaClientID);
    } else {
        console.log("_ga cookie exists:", gaClientID);
    }
}

// Run the function on page load
checkAndSetGAClientID();
