require('dotenv').config();
const express = require('express');
const cors = require('cors');
const paypal = require('@paypal/checkout-server-sdk');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// PayPal environment setup
function environment() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (process.env.PAYPAL_MODE === 'live') {
    return new paypal.core.LiveEnvironment(clientId, clientSecret);
  } else {
    return new paypal.core.SandboxEnvironment(clientId, clientSecret);
  }
}

// PayPal client
function client() {
  return new paypal.core.PayPalHttpClient(environment());
}

// Create order endpoint
app.post('/api/orders', async (req, res) => {
  try {
    const { amount, currency = 'USD', description = 'Purchase' } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer('return=representation');
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: currency,
          value: amount.toFixed(2)
        },
        description: description
      }],
      application_context: {
        brand_name: 'Your Business Name',
        landing_page: 'NO_PREFERENCE',
        user_action: 'PAY_NOW',
        return_url: `http://localhost:${PORT}/success.html`,
        cancel_url: `http://localhost:${PORT}/cancel.html`
      }
    });

    const order = await client().execute(request);
    res.json({
      orderID: order.result.id,
      status: order.result.status
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      error: 'Failed to create order',
      details: error.message
    });
  }
});

// Capture order endpoint
app.post('/api/orders/:orderID/capture', async (req, res) => {
  try {
    const orderID = req.params.orderID;
    const request = new paypal.orders.OrdersCaptureRequest(orderID);
    request.requestBody({});

    const capture = await client().execute(request);

    // Here you would typically:
    // 1. Verify the payment amount
    // 2. Update your database
    // 3. Send confirmation email
    // 4. Fulfill the order

    res.json({
      orderID: capture.result.id,
      status: capture.result.status,
      payer: capture.result.payer,
      purchase_units: capture.result.purchase_units
    });
  } catch (error) {
    console.error('Error capturing order:', error);
    res.status(500).json({
      error: 'Failed to capture order',
      details: error.message
    });
  }
});

// Get order details endpoint
app.get('/api/orders/:orderID', async (req, res) => {
  try {
    const orderID = req.params.orderID;
    const request = new paypal.orders.OrdersGetRequest(orderID);
    const order = await client().execute(request);

    res.json(order.result);
  } catch (error) {
    console.error('Error getting order:', error);
    res.status(500).json({
      error: 'Failed to get order details',
      details: error.message
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    mode: process.env.PAYPAL_MODE || 'sandbox'
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`PayPal Mode: ${process.env.PAYPAL_MODE || 'sandbox'}`);
});
