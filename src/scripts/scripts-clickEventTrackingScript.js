document.addEventListener('DOMContentLoaded', () => {
    const conversionUrl = 'http://localhost:5008/api/conversion/add-conversion';

    const getCookie = (name) => {
        const cookies = document.cookie.split(';').map(c => c.trim());
        const cookie = cookies.find(c => c.startsWith(`${name}=`));
        return cookie ? decodeURIComponent(cookie.split('=')[1]) : null;
    };

    const handleClick = async (type, value) => {
        const visitorId = getCookie('visitorId');
        const visitId = getCookie('visitId');

        const payload = {
            interactionType: type,
            interactionValue: value,
            userId,
            visitorId,
            visitId,
        };

        try {
            const res = await fetch(conversionUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const responseJson = await res.json();
            console.log('Interaction sent:', responseJson);
        } catch (err) {
            console.error('Failed to send interaction data:', err);
        }
    };

    // Add this regex for basic email and phone number detection
    const emailRegex = /[\w.-]+@[\w.-]+\.\w{2,}/;
    const phoneRegex = /(?:\+?\d{1,4}[ -]?)?(?:\(?\d{3,5}\)?[ -]?)?\d{3,4}[ -]?\d{3,4}/;

    document.body.addEventListener('click', (e) => {
        const target = e.target;

        // First check if it's an anchor with href
        const anchor = target.closest('a');
        if (anchor) {
            const href = anchor.getAttribute('href');
            if (href) {
                if (href.startsWith('mailto:')) {
                    const email = href.replace('mailto:', '');
                    return handleClick('email_click', email);
                } else if (href.startsWith('tel:')) {
                    e.preventDefault();
                    const phone = href.replace('tel:', '');
                    return handleClick('phone_click', phone).then(() => {
                        setTimeout(() => {
                            window.location.href = href;
                        }, 300);
                    });
                }
            }
        }

        // Now check if the plain text matches email or phone number
        const text = target.innerText || target.textContent;

        if (emailRegex.test(text)) {
            const email = text.match(emailRegex)[0];
            return handleClick('email_click', email);
        }

        if (phoneRegex.test(text)) {
            const phone = text.match(phoneRegex)[0];
            return handleClick('phone_click', phone);
        }
    });
});
