import Image from "next/image";
import { useEffect, useState } from "react";
import { useCookies } from "react-cookie";
import { Inter } from "next/font/google";
import { isInstalled, getPublicKey, signMessage, } from "@gemwallet/api";
import * as gemWalletApi from "@gemwallet/api";
import sdk from "@crossmarkio/sdk";
import { useConnect } from "thirdweb/react";
import { ConnectButton } from "thirdweb/react";
import { createThirdwebClient } from "thirdweb"
import { createWallet, injectedProvider } from "thirdweb/wallets"
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThirdwebProvider } from "thirdweb/react";

import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"


const inter = Inter({ subsets: ["latin"] });

const WALLET_TYPE = {
  GEM: "GEM WALLET",
  CROSS_MARK: "CROSS MARK WALLET",
  XUMUN: "XUMUN WALLET",
  LEDGER: "LEDGER WALLET",
  BIFROST: "BIFROST WALLET",
}

const clientId = process.env.NEXT_PUBLIC_TEMPLATE_CLIENT_ID || "";
const client = createThirdwebClient({ clientId });
const queryClient = new QueryClient();

export default function Home() {
  const [qrcode, setQrcode] = useState<string>("");
  const [jumpLink, setJumpLink] = useState<string>("");
  const [xrpAddress, setXrpAddress] = useState<string>("");
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [cookies, setCookie, removeCookie] = useCookies(["jwt"]);
  const [enableJwt, setEnableJwt] = useState<boolean>(false);
  const [retrieved, setRetrieved] = useState<boolean>(false);
  const [destinationAddress, setDestinationAddress] = useState<string>("");
  const [amount, setAmount] = useState<string>("0")
  const [connectedWallet, setConnectedWallet] = useState<string>('');
  const [showConnectButton, setShowConnectButton] = useState(false);
  const { connect, isConnecting, } = useConnect();

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
          const pubkey = response.result?.publicKey;
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

  const getQrCode = async () => {
    const payload = await fetch("/api/auth/xumm/createpayload");
    const data = await payload.json();

    setQrcode(data.payload.refs.qr_png);
    setJumpLink(data.payload.next.always);

    if (isMobile) {
      //open in new tab
      window.open(data.payload.next.always, "_blank");
    }

    const ws = new WebSocket(data.payload.refs.websocket_status);

    ws.onmessage = async (e) => {
      let responseObj = JSON.parse(e.data);
      if (responseObj.signed !== null && responseObj.signed !== undefined) {
        const payload = await fetch(
          `/api/auth/xumm/getpayload?payloadId=${responseObj.payload_uuidv4}`
        );
        const payloadJson = await payload.json();

        const hex = payloadJson.payload.response.hex;
        const checkSign = await fetch(`/api/auth/xumm/checksign?hex=${hex}`);
        const checkSignJson = await checkSign.json();
        setXrpAddress(checkSignJson.xrpAddress)
        setConnectedWallet(WALLET_TYPE.XUMUN)
        if (enableJwt) {
          setCookie("jwt", checkSignJson.token, { path: "/" });
        }
      } else {
        console.log(responseObj);
      }
    };
  };


  const sendToken = async () => {
    if (connectedWallet === WALLET_TYPE.GEM) {
      const payment = {
        amount: amount,
        destination: destinationAddress,
      }
      await gemWalletApi.sendPayment(payment);
    } else if (connectedWallet === WALLET_TYPE.CROSS_MARK) {
      let id = sdk.sync.signAndSubmit({
        TransactionType: 'Payment',
        Account: xrpAddress,
        Destination: destinationAddress,
        Amount: amount, // XRP in drops
      });
    } else if (connectedWallet === WALLET_TYPE.XUMUN) {
      const payload = await fetch(`/api/auth/xumm/sendWithXum?xrpAddress=${xrpAddress}&amount=${amount}&destinationAddress=${destinationAddress}`);
      const data = await payload.json()
      setQrcode(data.payload.refs.qr_png);
      setJumpLink(data.payload.next.always);

      if (isMobile) {
        //open in new tab
        window.open(data.payload.next.always, "_blank");
      }

      const ws = new WebSocket(data.payload.refs.websocket_status);

      ws.onmessage = async (e) => {
        let responseObj = JSON.parse(e.data);
        if (responseObj.signed !== null && responseObj.signed !== undefined) {
          const payload = await fetch(
            `/api/auth/xumm/getpayload?payloadId=${responseObj.payload_uuidv4}`
          );
          const payloadJson = await payload.json();

          const hex = payloadJson.payload.response.hex;
          const checkSign = await fetch(`/api/auth/xumm/checksign?hex=${hex}`);
          const checkSignJson = await checkSign.json();
          setXrpAddress(checkSignJson.xrpAddress)
          setConnectedWallet(WALLET_TYPE.XUMUN)
          if (enableJwt) {
            setCookie("jwt", checkSignJson.token, { path: "/" });
          }
        } else {
          console.log(responseObj);
        }
      };
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
          This is a template for creating a wallet connect app with XRPL. Includes basic JWT authentication and 5 different wallet types.
        </p>

        <Drawer>
          <DrawerTrigger className="mt-8 bg-blue-500 hover:bg-blue-600 w-48 h-12 rounded-lg text-white" onClick={getQrCode}>
            Connect with XAMAN
          </DrawerTrigger>
          <DrawerContent className="bg-white p-4">
            <DrawerHeader className="flex flex-col items-center">
              <DrawerTitle>Scann this qr code to sign in with xaman!</DrawerTitle>
            </DrawerHeader>
            <DrawerDescription className="flex flex-col items-center">
              {
                qrcode !== "" ? (
                  <Image
                    src={qrcode}
                    alt="xaman qr code"
                    width={200}
                    height={200}
                  />
                ) : (
                  <div className="flex flex-col space-y-3">
                    <Skeleton className="h-[250px] w-[250px] rounded-xl bg-gray-300" />
                  </div>
                )
              }
              {jumpLink !== "" && (
                <Button className="mt-2 bg-blue-400 hover:bg-blue-500 w-48 h-12" onClick={() => {
                  window.open(jumpLink, "_blank");
                }}>
                  Open in Xaman
                </Button>
              )}
            </DrawerDescription>
          </DrawerContent>
        </Drawer>

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
        <QueryClientProvider client={queryClient}>
          <ThirdwebProvider>
            <Button
              className="mt-2 bg-green-500 hover:bg-green-600 w-48 h-12"
              onClick={() =>
                connect(async () => {
                  const wallet = createWallet("com.bifrostwallet"); // pass the wallet id

                  // if user has wallet installed, connect to it
                  if (injectedProvider("com.bifrostwallet")) {
                    await wallet.connect({ client });
                    setShowConnectButton(true)
                  }

                  // open wallet connect modal so user can scan the QR code and connect
                  else {
                    await wallet.connect({
                      client,
                      walletConnect: {
                        showQrModal: true,
                      }
                    });
                    setShowConnectButton(true)
                  }
                  // return the wallet
                  return wallet;
                })
              }
            >
              Connect with Bifrost
            </Button>
            <Button
              className="mt-2 bg-blue-500 hover:bg-blue-600 w-48 h-12"
              onClick={() =>
                connect(async () => {
                  const wallet = createWallet("com.ledger"); // pass the wallet id

                  // Check if the user has the wallet installed and connect to it
                  if (injectedProvider("com.ledger")) {
                    await wallet.connect({ client });
                    setShowConnectButton(true)
                  } else {
                    // If the wallet is not detected, open WalletConnect modal for the user to scan the QR code and connect
                    await wallet.connect({
                      client,
                      walletConnect: {
                        showQrModal: true,
                      }
                    });
                    setShowConnectButton(true)
                  }
                  // Return the wallet to set it as the active wallet
                  return wallet;
                })
              }
            >
              Connect with Ledger
            </Button>
            {showConnectButton && (
              <div className=" my-5 flex justify-center items-center" >
                <ConnectButton
                  client={client}
                  appMetadata={{
                    name: "Example App",
                    url: "https://example.com",
                  }}
                />
              </div>
            )}
          </ThirdwebProvider>
        </QueryClientProvider>


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
      </div>
    </main>
  );
}
