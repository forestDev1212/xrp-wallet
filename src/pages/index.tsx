import Image from "next/image";
import { Inter } from "next/font/google";
import { Button } from "@/components/ui/button";
import { isInstalled, getPublicKey, signMessage,  } from "@gemwallet/api";
import * as gemWalletApi from "@gemwallet/api";
import { RippleAPI } from 'ripple-lib'
import sdk from "@crossmarkio/sdk";
import { useCookies } from "react-cookie";

import { useEffect, useState } from "react";

const inter = Inter({ subsets: ["latin"] });

const WALLET_TYPE = {
  GEM: "GEM WALLET",
  CROSS_MARK: "CROSS MARK WALLET",
}

export default function Home() {
  const [xrpAddress, setXrpAddress] = useState<string>("");
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [cookies, setCookie, removeCookie] = useCookies(["jwt"]);
  const [enableJwt, setEnableJwt] = useState<boolean>(false);
  const [retrieved, setRetrieved] = useState<boolean>(false);
  const [destinationAddress, setDestinationAddress] = useState<string>("");
  const [amount, setAmount] = useState<string>("0")
  const [message, setMessage] = useState<string>("")
  const [connectedWallet, setConnectedWallet] = useState<string>('');

  useEffect(() => {
    if (window.innerWidth < 768) {
      setIsMobile(true);
    }

    if (cookies.jwt !== undefined && cookies.jwt !== null) {
      const url = "/api/auth";
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: cookies.jwt }),
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.hasOwnProperty("xrpAddress")) {
            setXrpAddress(data.xrpAddress);
            setRetrieved(true);
          }
        });
    }
  }, []);


  const handleConnectGem = () => {
    isInstalled().then((response) => {
      if (response.result.isInstalled) {
        getPublicKey().then((response) => {
          // console.log(`${response.result?.address} - ${response.result?.publicKey}`);
          const pubkey = response.result?.publicKey;
          //fetch nonce from /api/gem/nonce?pubkey=pubkey
          fetch(
            `/api/auth/gem/nonce?pubkey=${pubkey}&address=${response.result?.address}`
          )
            .then((response) => response.json())
            .then((data) => {
              const nonceToken = data.token;
              const opts = {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${nonceToken}`,
                },
              };
              signMessage(nonceToken).then((response) => {
                const signedMessage = response.result?.signedMessage;
                if (signedMessage !== undefined) {
                  //post at /api/gem/checksign?signature=signature
                  fetch(`/api/auth/gem/checksign?signature=${signedMessage}`, opts)
                    .then((response) => response.json())
                    .then((data) => {
                      const { token, address } = data;
                      if (token === undefined) {
                        console.log("error");
                        return;
                      }
                      setXrpAddress(address);
                      setConnectedWallet(WALLET_TYPE.GEM)
                      if (enableJwt) {
                        setCookie("jwt", token, { path: "/" });
                      }
                    });
                }
              });
            });
        });
      }
    });
  };

  const handleConnectCrossmark = async () => {
    //sign in first, then generate nonce
    const hashUrl = "/api/auth/crossmark/hash";
    const hashR = await fetch(hashUrl);
    const hashJson = await hashR.json();
    const hash = hashJson.hash;
    const id = await sdk.methods.signInAndWait(hash)
    console.log(id);
    const address = id.response.data.address;
    const pubkey = id.response.data.publicKey;
    const signature = id.response.data.signature;
    const checkSign = await fetch(
      `/api/auth/crossmark/checksign?signature=${signature}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${hash}`,
        },
        body: JSON.stringify({
          pubkey: pubkey,
          address: address,
        }),
      }
    );

    const checkSignJson = await checkSign.json();
    if (checkSignJson.hasOwnProperty("token")) {
      setXrpAddress(address);
      setConnectedWallet(WALLET_TYPE.CROSS_MARK)
      if (enableJwt) {
        setCookie("jwt", checkSignJson.token, { path: "/" });
      }
    }
  };


  const sendToken = async () => {
    console.log(connectedWallet)
    if (connectedWallet === WALLET_TYPE.GEM) {
      const payment = {
        amount: amount,
        destination: destinationAddress,
      }
      const result = await gemWalletApi.sendPayment(payment);
      console.log(result)
    } else if (connectedWallet === WALLET_TYPE.CROSS_MARK) {
      let id = sdk.sync.signAndSubmit({
        TransactionType: 'Payment',
        Account: xrpAddress,
        Destination: destinationAddress,
        Amount: amount, // XRP in drops
      });
      console.log(id)
    } else {
      return true
    }
  }

  return (
    <main
      className={`flex min-h-screen flex-col items-center justify-between p-24 ${inter.className}`}
    >
      <div className="flex flex-col items-center">
        <h1 className="text-4xl font-bold text-center">
          Welcome to XRPL wallet connect template!
        </h1>
        <p className="text-center mt-4 text-lg">
          This is a template for creating a wallet connect app with XRPL. Includes basic JWT authentication and 3 different wallet types.
        </p>

        <Button
          className="mt-2 bg-blue-400 hover:bg-blue-500 w-48 h-12"
          onClick={handleConnectGem}
        >
          Connect with GEM
        </Button>
        <Button
          className="mt-2 bg-orange-500 hover:bg-orange-600 w-48 h-12"
          onClick={handleConnectCrossmark}
        >
          Connect with Crossmark
        </Button>


        <div className="mt-8">
          {xrpAddress !== "" && (
            <p className="text-center">
              Your XRP address is: <a className="font-bold" href={`https://bithomp.com/explorer/${xrpAddress}`}>{xrpAddress.slice(0, 3)}...{xrpAddress.slice(-3)}</a>{" "}
              {retrieved && (
                <span className="text-red-500 underline" onClick={() => {
                  removeCookie("jwt");
                  setRetrieved(false);
                  setXrpAddress("");
                }}>
                  (Retrieved from cookies, click to remove)
                </span>
              )}
            </p>
          )}
        </div>
        {
          xrpAddress !== "" && (
            <div className=" w-full max-w-[600px] flex justify-center items-center mx-auto" >
              <div className=" w-full " >
                <div className="relative z-0 w-full mb-5 group">
                  <input
                    type="text"
                    name="floating_address"
                    id="floating_address"
                    value={destinationAddress}
                    onChange={(e) => setDestinationAddress(e.target.value)}
                    className="block py-2.5 px-0 w-full text-sm text-gray-900 bg-transparent border-0 border-b-2 border-gray-300 appearance-none dark:text-white dark:border-gray-600 dark:focus:border-blue-500 focus:outline-none focus:ring-0 focus:border-blue-600 peer"
                    placeholder=" "
                    required
                  />
                  <label
                    htmlFor="floating_address"
                    className={`absolute text-sm text-gray-500 dark:text-gray-400 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] ${destinationAddress ? 'peer-focus:font-medium' : ''
                      } start-0 rtl:peer-focus:translate-x-1/4 rtl:peer-focus:left-auto peer-focus:text-blue-600 peer-focus:dark:text-blue-500 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6`}
                  >
                    Receiver address
                  </label>
                </div>

                <div className="relative z-0 w-full mb-5 group">
                  <input
                    type="number"
                    name="floating_amount"
                    id="floating_amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="block py-2.5 px-0 w-full text-sm text-gray-900 bg-transparent border-0 border-b-2 border-gray-300 appearance-none dark:text-white dark:border-gray-600 dark:focus:border-blue-500 focus:outline-none focus:ring-0 focus:border-blue-600 peer"
                    placeholder=" "
                    required
                  />
                  <label
                    htmlFor="floating_amount"
                    className={`absolute text-sm text-gray-500 dark:text-gray-400 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] ${amount ? 'peer-focus:font-medium' : ''
                      } start-0 rtl:peer-focus:translate-x-1/4 rtl:peer-focus:left-auto peer-focus:text-blue-600 peer-focus:dark:text-blue-500 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6`}
                  >
                    Amount(XRP)
                  </label>
                </div>

                <div className="flex justify-center items-center" >
                  <Button
                    className="mt-2 bg-blue-400 hover:bg-blue-500 w-48 h-12"
                    onClick={sendToken}
                    disabled={(parseFloat(amount) > 0 && destinationAddress) ? false : true}
                  >
                    SEND
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                    </svg>
                  </Button>
                </div>

              </div>
            </div>
          )
        }
        <div className=" flex justify-center items-center" >
          <p>
            {message}
          </p>
        </div>
      </div>

    </main>
  );
}
