const API_BASE_URL = 'http://localhost:3000/api';

// Update display amount when amount input changes
document.getElementById('amount').addEventListener('input', (e) => {
    const amount = parseFloat(e.target.value) || 0;
    document.getElementById('display-amount').textContent = amount.toFixed(2);
});

// Show message to user
function showMessage(text, type = 'error') {
    const messageEl = document.getElementById('message');
    messageEl.textContent = text;
    messageEl.className = `message ${type} active`;

    if (type === 'success') {
        setTimeout(() => {
            messageEl.classList.remove('active');
        }, 5000);
    }
}

// Show/hide loading spinner
function setLoading(isLoading) {
    const loadingEl = document.getElementById('loading');
    const payButton = document.getElementById('pay-button');
    const form = document.getElementById('payment-form');

    if (isLoading) {
        loadingEl.classList.add('active');
        payButton.disabled = true;
        form.style.opacity = '0.5';
    } else {
        loadingEl.classList.remove('active');
        payButton.disabled = false;
        form.style.opacity = '1';
    }
}

// Create PayPal order
async function createOrder(amount, currency, description) {
    try {
        const response = await fetch(`${API_BASE_URL}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                amount: parseFloat(amount),
                currency: currency,
                description: description
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create order');
        }

        const data = await response.json();
        return data.orderID;
    } catch (error) {
        console.error('Create order error:', error);
        throw error;
    }
}

// Capture PayPal order
async function captureOrder(orderID) {
    try {
        const response = await fetch(`${API_BASE_URL}/orders/${orderID}/capture`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to capture order');
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Capture order error:', error);
        throw error;
    }
}

// Get PayPal approval URL
function getApprovalUrl(orderID) {
    // In sandbox mode, the approval URL follows this pattern
    const mode = 'sandbox'; // This would come from your environment
    return `https://www.${mode}.paypal.com/checkoutnow?token=${orderID}`;
}

// Handle form submission
document.getElementById('payment-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const amount = document.getElementById('amount').value;
    const currency = document.getElementById('currency').value;
    const description = document.getElementById('description').value;

    // Validate amount
    if (!amount || parseFloat(amount) <= 0) {
        showMessage('Please enter a valid amount', 'error');
        return;
    }

    setLoading(true);

    try {
        // Step 1: Create the order
        const orderID = await createOrder(amount, currency, description);
        console.log('Order created:', orderID);

        // Step 2: Redirect to PayPal for approval
        const approvalUrl = getApprovalUrl(orderID);

        // Store order ID in session storage for later capture
        sessionStorage.setItem('pendingOrderID', orderID);
        sessionStorage.setItem('orderAmount', amount);
        sessionStorage.setItem('orderCurrency', currency);

        // Redirect to PayPal
        window.location.href = approvalUrl;

    } catch (error) {
        setLoading(false);
        showMessage(error.message || 'Payment failed. Please try again.', 'error');
    }
});

// Check for returning payment (from PayPal redirect)
window.addEventListener('load', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const payerID = urlParams.get('PayerID');

    if (token && payerID) {
        // User returned from PayPal
        handlePayPalReturn(token, payerID);
    }
});

// Handle return from PayPal
async function handlePayPalReturn(orderID, payerID) {
    setLoading(true);

    try {
        // Capture the payment
        const captureData = await captureOrder(orderID);
        console.log('Payment captured:', captureData);

        // Clear session storage
        sessionStorage.removeItem('pendingOrderID');
        sessionStorage.removeItem('orderAmount');
        sessionStorage.removeItem('orderCurrency');

        // Show success message
        const amount = captureData.purchase_units[0].amount.value;
        const currency = captureData.purchase_units[0].amount.currency_code;

        showMessage(
            `Payment successful! Amount: ${currency} ${amount}. Transaction ID: ${captureData.orderID}`,
            'success'
        );

        // Clear the URL parameters
        window.history.replaceState({}, document.title, window.location.pathname);

        setLoading(false);

        // You could redirect to a success page here
        // setTimeout(() => {
        //     window.location.href = '/success.html';
        // }, 2000);

    } catch (error) {
        setLoading(false);
        showMessage('Failed to complete payment. Please contact support.', 'error');
    }
}

// Check server health on load
fetch(`${API_BASE_URL}/health`)
    .then(res => res.json())
    .then(data => {
        console.log('Server status:', data);
    })
    .catch(err => {
        console.error('Server not responding:', err);
        showMessage('Unable to connect to payment server. Please try again later.', 'error');
    });
