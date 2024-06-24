const { sendPayment } = require("@gemwallet/api")

export default async function handler(req, res) {
  try {
    const { amount, destinationAddress } = req.query
    const payment = {
      amount: amount,
      destination: destinationAddress,
    }
    const result = await sendPayment(payment);
    console.log(result)
    res.status(200).json({ result: result });
  } catch (err) {
    console.log(`Err : ${err}`)
    res.status(400).json({ error: error.message, line: error.stack });
  }

}