window.onload = function() {
    // Check if the URL has an authorization code
    const urlParams = new URLSearchParams(window.location.search);
    const authCode = urlParams.get('code');

    if (authCode) {
        // Send the authorization code to the backend Lambda function
        sendCodeToBackend(authCode);
    } else {
        // Check if the user is already authenticated by checking for ID token in cookies
        checkUserAuthentication();
    }
};

// Function to send the authorization code to the backend Lambda function
function sendCodeToBackend(authCode) {
    const lambdaEndpoint = 'https://phzc2smjqk.execute-api.ap-south-1.amazonaws.com/prod/User_Registration'; // Replace with your API Gateway endpoint

    fetch(lambdaEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code: authCode })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Error: ${response.status} ${response.statusText}`);
        }
        return response.json();
    })
    .then(data => {
        // Successfully received tokens from the backend, save tokens in cookies
        document.cookie = `id_token=${data.tokens.id_token}; path=/;`;
        document.cookie = `access_token=${data.tokens.access_token}; path=/;`;
        document.cookie = `refresh_token=${data.tokens.refresh_token}; path=/;`;
        document.cookie = `details=${data.tokens.details}; path=/;`;
        document.cookie = `device_id=${data.tokens.device_id}; path=/;`;

        // Log the cookies after saving the tokens
        console.log("Tokens saved in cookies:", document.cookie);

        // Extract and save user details from the ID token
        extractUserDetailsFromToken(data.tokens.id_token);

        // Clear the authorization code from the URL to avoid re-triggering the exchange
        clearAuthCodeFromUrl();
    })
    .catch(error => {
        console.error('Error:', error);
        document.getElementById('user-info').innerHTML = `<p>${error.message || 'Something went wrong.'}</p>`;
    });
}

// Function to extract user details from the token and store in cookies
function extractUserDetailsFromToken(idToken) {
    const tokenPayload = JSON.parse(atob(idToken.split('.')[1]));
    const { name, birthdate, email, gender } = tokenPayload;
    const username = tokenPayload['cognito:username'];

    // Function to get a cookie value by name
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
    }

    // Get details and device_id from cookies
    const details = getCookie('details') || 'none';
    const device_id = getCookie('device_id') || 'none';

    // Save user details in cookies
    document.cookie = `name=${name}; path=/;`;
    document.cookie = `birthdate=${birthdate}; path=/;`;
    document.cookie = `username=${username}; path=/;`;
    document.cookie = `email=${email}; path=/;`;
    document.cookie = `gender=${gender}; path=/;`;
    document.cookie = `details=${details}; path=/;`;
    document.cookie = `device_id=${device_id}; path=/;`;

    // Log the cookies after saving user details
    console.log("User details saved in cookies:", document.cookie);

    // Display the user information
    displayUserInfo();
    // Refresh the page automatically
    location.reload();

}

// Function to check user authentication by reading cookies
function checkUserAuthentication() {
    const cookies = getCookies();
    const idToken = cookies['id_token'];
    const detailsAvailable = cookies['details'] === 'true';

    // Log the cookies when checking authentication
    console.log("Checking cookies:", document.cookie);

    if (idToken && detailsAvailable) {
        // Display user information from cookies
        displayUserInfo();
        openDeviceModal();
    } else if (idToken && !detailsAvailable) {
        // If details are not filled, show the mandatory form
        document.getElementById('mandatory-form').style.display = 'block';
    } else {
        document.getElementById('user-info').innerHTML = '<p>Error: No authorization code found, and no existing session.</p>';
    }
}

// Function to display user information from cookies
function displayUserInfo() {
    const cookies = getCookies();
    document.getElementById('user-info').innerHTML = `
        <p>Name: ${cookies['name']}</p>
        <p>Birthdate: ${cookies['birthdate']}</p>
        <p>Username: ${cookies['username']}</p>
        <p>Email: ${cookies['email']}</p>
        <p>Gender: ${cookies['gender']}</p>
    `;
}

// Utility function to read all cookies and return as an object
function getCookies() {
    return document.cookie.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
    }, {});
}

// Utility function to remove the authorization code from the URL
function clearAuthCodeFromUrl() {
    const url = new URL(window.location.href);
    url.searchParams.delete('code');
    window.history.replaceState({}, document.title, url.toString());
}

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

// Function to send form data to the backend Lambda function
function sendFormData() {
    const formData = {
        height: document.getElementById('height').value,
        device_id: document.getElementById('device_id').value,
        username: getCookie('username')
    };

    const lambdaEndpoint = 'https://2sf2iqm6je.execute-api.ap-south-1.amazonaws.com/prod/Details';

    fetch(lambdaEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
    })
    .then(response => {
        if (response.status === 200) {
            return response.json();
        } else {
            throw new Error('Failed to save details.');
        }
    })
    .then(data => {
        // Save form data in cookies
        document.cookie = `height=${formData.height}; path=/;`;
        document.cookie = `device_id=${formData.device_id}; path=/;`;
        document.cookie = `details=true; path=/;`;

        // Log the cookies after saving form data
        console.log("Form data saved in cookies:", document.cookie);

        alert('Details saved successfully!');
        document.getElementById('mandatory-form').style.display = 'none';
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Error saving details.');
    });
}

// Function to open the device modal
function openDeviceModal() {
    document.getElementById('device-modal').style.display = 'block';
}

// Function to connect the frontend to a WebSocket for real-time data
function connectDevice() {
    const websocketUrl = 'wss://your-websocket-endpoint';
    const socket = new WebSocket(websocketUrl);

    socket.onopen = function() {
        console.log('Connected to WebSocket');
    };

    socket.onmessage = function(event) {
        const imageData = event.data;
        // Update the frontend with the image data received from the WebSocket
        document.querySelector('.modal-content img').src = `data:image/jpeg;base64,${imageData}`;
    };

    socket.onerror = function(error) {
        console.error('WebSocket Error:', error);
    };
}
