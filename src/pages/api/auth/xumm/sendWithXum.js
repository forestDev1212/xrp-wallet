const { XummSdk } = require("xumm-sdk");

export default async function handler(req, res) {
  try {
    // Initialize the XUMM SDK with environment variables securely
    const xumm = new XummSdk(
      process.env.XUMM_KEY,
      process.env.XUMM_KEY_SECRET
    );

    // Extract details from the request body sent by the client
    const { xrpAddress, destinationAddress, amount } = req.query;

    // Create the payment payload
    const paymentPayload = {
      txjson: {
        TransactionType: "Payment",
        Account: xrpAddress,
        Destination: destinationAddress,
        Amount: amount,  // Ensure this is in the correct format (drops for XRP)
      },
    };

    // Send the payload to XUMM
    const payloadResponse = await xumm.payload.create(paymentPayload, true);
    console.log("Payload Response:", payloadResponse);

    // Return the response
    return res.status(200).json({ payload: payloadResponse });
  } catch (error) {
    console.error("Error creating payload:", error);
    res.status(400).json({ error: error.message });
  }
}
