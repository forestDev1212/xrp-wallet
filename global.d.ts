interface Window {
  bifrost: {
    connect: () => Promise<{ isConnected: boolean; address: string }>;
    sendTransaction: (params: { to: string; amount: number }) => Promise<any>;
  };
}