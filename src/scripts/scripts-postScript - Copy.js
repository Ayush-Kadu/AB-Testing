// Function to get user IP address
function getUserIpAddress() {
    return fetch('https://api.ipify.org?format=json')
      .then((response) => response.json())
      .then((data) => data.ip)
      .catch((error) => {
        console.error('Error fetching IP address:', error);
        return null;
      });
  }
  
  // Function to get city name from IP
  async function getCityName(ip) {
    var myHeaders = new Headers();
    myHeaders.append("apikey", "COPfLBl29trVqnt3EmBHBmrZ0Tes31CG");
  
    var requestOptions = {
      method: 'GET',
      redirect: 'follow',
      headers: myHeaders
    };
  
    try {
      const response = await fetch(`https://api.apilayer.com/ip_to_location/${ip}`, requestOptions);
      const result = await response.json();
      console.log(result);
  
      // Extract city and country information from the API response
      const city = result.city;
      const country = result.country_name;
      const region_name = result.region_name;
      const latitude = result.latitude;
      const longitude = result.longitude;
      return { city, country, region_name, latitude, longitude };
    } catch (error) {
      console.log('Error fetching city name:', error);
      return { city: null, country: null };
    }
  }
  
  // Function to set a cookie
  function setCookie(name, value, daysToExpire) {
    const date = new Date();
    date.setTime(date.getTime() + daysToExpire * 24 * 60 * 60 * 1000);
    const expires = 'expires=' + date.toUTCString();
    document.cookie = name + '=' + value + '; ' + expires;
  }
  
  // Function to get a cookie by name
  function getCookie(name) {
    var nameEQ = name + '=';
    var ca = document.cookie.split(';');
    for (var i = 0; i < ca.length; i++) {
      var c = ca[i];
      while (c.charAt(0) == ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
  }
  
  // Function to parse URL parameters into an object
  function parseUrlParameters(url) {
    const paramString = url.split('?')[1];
    const queryString = new URLSearchParams(paramString);
    const urlObject = {};
  
    for (let pair of queryString.entries()) {
      urlObject[pair[0]] = pair[1];
    }
  
    return urlObject;
  }
  
  // Function to generate a unique user ID and store it in a cookie
  function generateUniqueUserID() {
    const cookieName = 'uniqueUserID';
  
    // Check if the user already has a unique ID stored in a cookie
    const existingUserID = getCookie(cookieName);
  
    if (existingUserID) {
      return existingUserID;
    }
  
    // Generate a new unique ID (you can use a library for this)
    const newUserID = generateRandomUniqueID();
  
    // Store the unique ID in a cookie (set the expiration date as needed)
    setCookie(cookieName, newUserID, 365); // 365 days, for example
  
    return newUserID;
  }
  
  function generateRandomUniqueID() {
    const timestamp = new Date().getTime(); // Current timestamp
    const randomValue = Math.random() * 2000 + 1; // Random number between 0 and 1
    const uniqueID = timestamp + '_' + randomValue;
  
    return uniqueID;
  }
  
  // Set landing page cookies
  function setLandingPageCookie() {
    const landingPageCookie = getCookie('landingPageCookie');
  
    if (!landingPageCookie) {
      // If landing page cookie doesn't exist, set it to the current page URL
      const currentPageUrl = window.location.href;
      setCookie('landingPageCookie', currentPageUrl, 365);
      return currentPageUrl;
    } else {
      return landingPageCookie;
    }
  }
  
  // Function to get Google Analytics client ID
  function getGaClientId() {
    const gaCookie = document.cookie.split(';').find((cookie) => cookie.trim().startsWith('_ga='));
  
    if (gaCookie) {
      const gaClientId = gaCookie.split('.').slice(-2).join('.');
      return gaClientId;
    } else {
      return null;
    }
  }
  
  // Function to get user device information
  function getUserDeviceInfo() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isTablet = /Tablet|iPad/i.test(navigator.userAgent);
    const isTV = /TV/i.test(navigator.userAgent);
  
    let deviceType = 'Desktop';
  
    if (isMobile) {
      deviceType = 'Mobile';
    } else if (isTablet) {
      deviceType = 'Tablet';
    } else if (isTV) {
      deviceType = 'TV';
    }
  
    const deviceInfo = {
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      deviceType: deviceType,
    };
  
    return deviceInfo;
  }
  
  // Initialize the user's IP address and get the city name
  var userIp = null;
  let deviceInfo = null;
  
  getUserIpAddress()
    .then((ip) => {
      userIp = ip;
      console.log("myip", userIp);
      return getCityName(userIp);
    })
    .then((cityData) => {
      console.log("city", cityData, cityData.longitude, cityData.latitude, cityData.region_name);
      const city = cityData.city;
      const country = cityData.country;
      const region_name = cityData.region_name;
      const latitude = cityData.latitude;
      const longitude = cityData.longitude;
      console.log("city", cityData, longitude, latitude, region_name);
  
      // Check if the user already has a first referrer stored in a cookie
      const firstReferrer = getCookie('firstReferrer');
  
      // If no first referrer is found, use the current document.referrer
      const firstReferrerValue = firstReferrer || document.referrer;
  
      // Create the initial user cookie with the IP address, city name, and device info
      deviceInfo = getUserDeviceInfo();
      const userCookie = getCookie('userCookie');
      const initialUserCookie = {
        Id: generateUniqueUserID(),
        userIp: userIp,
        gaClientId: getGaClientId(),
        originalRef: firstReferrerValue, // Added: Original referral - first touch
        ref: document.referrer, // Added: Last touch referral
  
        landingPage: setLandingPageCookie(), // Added: Landing page - first touch
        url: window.location.href, // Added: Last touch URL
        urlBase: new URL(window.location.href).origin, // Added: Base URL only
        organicSource: getOrganicSource(), // Added: Organic source href
        organicSourceStr: getOrganicSourceString(), // Added: Organic source string
        userAgent: navigator.userAgent.substring(0, 15),
        trafficSource: getTrafficSource(),
        firstTrafficSource: getFirstTrafficSource(), // Added: First touch traffic source
        interactions: [],
        domain: window.location.hostname,
        cityName: city, // Store the city name
        region_name: region_name,
        latitude: latitude,
        longitude: longitude,
        countryName: country,
        deviceInfo: deviceInfo, // Added: User device information
      };
  
      console.log("initialUserCookie", initialUserCookie);
      setCookie('userCookie', JSON.stringify(initialUserCookie), 365);
    })
    .catch((error) => {
      console.error('Error during initialization:', error);
    });
  
  // Function to get traffic source
  function getTrafficSource() {
    const referrer = document.referrer;
  
    // Check if the referrer is not empty and is different from the current URL
    if (referrer && referrer !== window.location.href) {
      return 'Referral'; // Updated: Return 'Referral' as the traffic source
    } else {
      // If referrer is empty or the same as the current URL, consider it direct traffic
      return 'Direct Traffic';
    }
  }
  
  // Function to get first touch traffic source
  function getFirstTrafficSource() {
    const firstReferrer = document.cookie.split(';').find((cookie) => cookie.trim().startsWith('firstReferrer='));
  
    if (firstReferrer) {
      return firstReferrer.split('=')[1];
    } else {
      return 'Direct Traffic';
    }
  }
  
  // Function to get organic source href
  function getOrganicSource() {
    const queryParams = new URLSearchParams(window.location.search);
    const organicSource = queryParams.get('utm_source');
    return organicSource || null;
  }
  
  // Function to get organic source string
  function getOrganicSourceString() {
    const queryParams = new URLSearchParams(window.location.search);
    const organicSource = queryParams.get('utm_source');
    return organicSource ? queryParams.toString() : null;
  }
  
  // State to track user interactions
  const interactions = [5];
  
  // Function to update the user's cookie with the latest interactions
  function updateUserCookieWithInteractions(interactions) {
    const userCookie = getCookie('userCookie');
  
    if (userCookie) {
      const userCookieData = JSON.parse(userCookie);
  
      // Append the userAgent from the latest interaction
      userCookieData.interactions = interactions.map((interaction) => ({
        ...interaction,
        userAgent: navigator.userAgent,
        clientId: newClientId
      }));
  
      setCookie('userCookie', JSON.stringify(userCookieData), 365);
  
      // Send the user cookie data to the server
      postUserDataToServer(userCookieData);
    }
  }
  
  updateUserCookieWithInteractions(interactions);
  
  // Function to send user cookie data to the server
  function postUserDataToServer(userData) {

    console.log('userData:asfasf ', newClientId);
    userData["clientId"] = newClientId
    const firebaseUrl = 'http://localhost:5008/api/v2/visitors';
    console.log('firebaseUrl: ', firebaseUrl);
  
    fetch(firebaseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
  
      body: JSON.stringify(userData),
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then(data => {
        console.log('Data posted successfully:', data);
      })
      .catch(error => {
        console.error('Error posting data to server:', error);
      });
  }
  