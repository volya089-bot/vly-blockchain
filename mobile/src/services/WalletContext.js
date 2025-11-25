import React, { createContext, useContext, useReducer, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateMnemonic, mnemonicToSeedSync } from 'bip39';
import * as bitcoin from 'bitcoinjs-lib';
import CryptoJS from 'crypto-js';

// VLY network configuration (similar to Bitcoin testnet but with VLY specifics)
const VLY_NETWORK = {
  messagePrefix: '\x18VLY Signed Message:\n',
  bech32: 'vly',
  bip32: {
    public: 0x043587cf,
    private: 0x04358394,
  },
  pubKeyHash: 0x00,
  scriptHash: 0x05,
  wif: 0x80,
};

// Initial state
const initialState = {
  isInitialized: false,
  hasWallet: false,
  isLocked: true,
  address: null,
  balance: 0,
  transactions: [],
  mnemonic: null,
  keyPair: null,
  loading: false,
  error: null,
};

// Action types
const WALLET_ACTIONS = {
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  INITIALIZE: 'INITIALIZE',
  CREATE_WALLET: 'CREATE_WALLET',
  IMPORT_WALLET: 'IMPORT_WALLET',
  UNLOCK_WALLET: 'UNLOCK_WALLET',
  LOCK_WALLET: 'LOCK_WALLET',
  UPDATE_BALANCE: 'UPDATE_BALANCE',
  UPDATE_TRANSACTIONS: 'UPDATE_TRANSACTIONS',
  CLEAR_ERROR: 'CLEAR_ERROR',
};

// Reducer
function walletReducer(state, action) {
  switch (action.type) {
    case WALLET_ACTIONS.SET_LOADING:
      return { ...state, loading: action.payload };
    case WALLET_ACTIONS.SET_ERROR:
      return { ...state, error: action.payload, loading: false };
    case WALLET_ACTIONS.CLEAR_ERROR:
      return { ...state, error: null };
    case WALLET_ACTIONS.INITIALIZE:
      return {
        ...state,
        isInitialized: true,
        hasWallet: action.payload.hasWallet,
        loading: false,
      };
    case WALLET_ACTIONS.CREATE_WALLET:
    case WALLET_ACTIONS.IMPORT_WALLET:
      return {
        ...state,
        hasWallet: true,
        isLocked: false,
        address: action.payload.address,
        mnemonic: action.payload.mnemonic,
        keyPair: action.payload.keyPair,
        loading: false,
      };
    case WALLET_ACTIONS.UNLOCK_WALLET:
      return {
        ...state,
        isLocked: false,
        address: action.payload.address,
        keyPair: action.payload.keyPair,
        loading: false,
      };
    case WALLET_ACTIONS.LOCK_WALLET:
      return {
        ...state,
        isLocked: true,
        address: null,
        keyPair: null,
        mnemonic: null,
      };
    case WALLET_ACTIONS.UPDATE_BALANCE:
      return { ...state, balance: action.payload };
    case WALLET_ACTIONS.UPDATE_TRANSACTIONS:
      return { ...state, transactions: action.payload };
    default:
      return state;
  }
}

// Context
const WalletContext = createContext();

// Storage keys
const STORAGE_KEYS = {
  ENCRYPTED_WALLET: 'vly_encrypted_wallet',
  WALLET_CONFIG: 'vly_wallet_config',
};

// Utility functions
function generateKeyPairFromMnemonic(mnemonic) {
  const seed = mnemonicToSeedSync(mnemonic);
  const root = bitcoin.bip32.fromSeed(seed, VLY_NETWORK);
  
  // Use standard derivation path for Bitcoin/VLY: m/44'/0'/0'/0/0
  const keyPair = root.derivePath("m/44'/0'/0'/0/0");
  
  return keyPair;
}

function getAddressFromKeyPair(keyPair) {
  // Generate Bech32 address for VLY
  const { address } = bitcoin.payments.p2wpkh({
    pubkey: keyPair.publicKey,
    network: VLY_NETWORK,
  });
  return address;
}

function encryptData(data, password) {
  return CryptoJS.AES.encrypt(JSON.stringify(data), password).toString();
}

function decryptData(encryptedData, password) {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData, password);
    return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
  } catch (error) {
    throw new Error('Invalid password');
  }
}

// Provider component
export function WalletProvider({ children }) {
  const [state, dispatch] = useReducer(walletReducer, initialState);

  // Initialize wallet on app start
  useEffect(() => {
    initializeWallet();
  }, []);

  const initializeWallet = async () => {
    try {
      dispatch({ type: WALLET_ACTIONS.SET_LOADING, payload: true });
      
      const encryptedWallet = await AsyncStorage.getItem(STORAGE_KEYS.ENCRYPTED_WALLET);
      const hasWallet = !!encryptedWallet;
      
      dispatch({
        type: WALLET_ACTIONS.INITIALIZE,
        payload: { hasWallet },
      });
    } catch (error) {
      dispatch({ type: WALLET_ACTIONS.SET_ERROR, payload: error.message });
    }
  };

  const createWallet = async (password) => {
    try {
      dispatch({ type: WALLET_ACTIONS.SET_LOADING, payload: true });
      
      // Generate mnemonic
      const mnemonic = generateMnemonic();
      
      // Generate key pair
      const keyPair = generateKeyPairFromMnemonic(mnemonic);
      
      // Get address
      const address = getAddressFromKeyPair(keyPair);
      
      // Encrypt and store wallet
      const walletData = {
        mnemonic,
        address,
        created: new Date().toISOString(),
      };
      
      const encryptedWallet = encryptData(walletData, password);
      await AsyncStorage.setItem(STORAGE_KEYS.ENCRYPTED_WALLET, encryptedWallet);
      
      dispatch({
        type: WALLET_ACTIONS.CREATE_WALLET,
        payload: { address, mnemonic, keyPair },
      });
      
      return mnemonic;
    } catch (error) {
      dispatch({ type: WALLET_ACTIONS.SET_ERROR, payload: error.message });
      throw error;
    }
  };

  const importWallet = async (mnemonic, password) => {
    try {
      dispatch({ type: WALLET_ACTIONS.SET_LOADING, payload: true });
      
      // Validate mnemonic
      if (!mnemonic || mnemonic.split(' ').length !== 12) {
        throw new Error('Invalid mnemonic phrase');
      }
      
      // Generate key pair
      const keyPair = generateKeyPairFromMnemonic(mnemonic);
      
      // Get address
      const address = getAddressFromKeyPair(keyPair);
      
      // Encrypt and store wallet
      const walletData = {
        mnemonic,
        address,
        imported: new Date().toISOString(),
      };
      
      const encryptedWallet = encryptData(walletData, password);
      await AsyncStorage.setItem(STORAGE_KEYS.ENCRYPTED_WALLET, encryptedWallet);
      
      dispatch({
        type: WALLET_ACTIONS.IMPORT_WALLET,
        payload: { address, mnemonic, keyPair },
      });
    } catch (error) {
      dispatch({ type: WALLET_ACTIONS.SET_ERROR, payload: error.message });
      throw error;
    }
  };

  const unlockWallet = async (password) => {
    try {
      dispatch({ type: WALLET_ACTIONS.SET_LOADING, payload: true });
      
      const encryptedWallet = await AsyncStorage.getItem(STORAGE_KEYS.ENCRYPTED_WALLET);
      if (!encryptedWallet) {
        throw new Error('No wallet found');
      }
      
      const walletData = decryptData(encryptedWallet, password);
      const keyPair = generateKeyPairFromMnemonic(walletData.mnemonic);
      
      dispatch({
        type: WALLET_ACTIONS.UNLOCK_WALLET,
        payload: { address: walletData.address, keyPair },
      });
    } catch (error) {
      dispatch({ type: WALLET_ACTIONS.SET_ERROR, payload: error.message });
      throw error;
    }
  };

  const lockWallet = () => {
    dispatch({ type: WALLET_ACTIONS.LOCK_WALLET });
  };

  const updateBalance = async () => {
    if (!state.address) return;
    
    try {
      // In a real implementation, you would call the VLY node or explorer API
      // For now, we'll simulate with a placeholder
      const balance = 0; // TODO: Implement actual balance checking
      dispatch({ type: WALLET_ACTIONS.UPDATE_BALANCE, payload: balance });
    } catch (error) {
      console.error('Failed to update balance:', error);
    }
  };

  const getTransactions = async () => {
    if (!state.address) return [];
    
    try {
      // In a real implementation, you would call the VLY node or explorer API
      // For now, we'll return an empty array
      const transactions = []; // TODO: Implement actual transaction fetching
      dispatch({ type: WALLET_ACTIONS.UPDATE_TRANSACTIONS, payload: transactions });
      return transactions;
    } catch (error) {
      console.error('Failed to get transactions:', error);
      return [];
    }
  };

  const sendTransaction = async (toAddress, amount, fee = 0.001) => {
    if (!state.keyPair || !state.address) {
      throw new Error('Wallet is locked');
    }

    try {
      // In a real implementation, you would:
      // 1. Get UTXOs for the address
      // 2. Build the transaction
      // 3. Sign the transaction
      // 4. Broadcast to the VLY network
      
      // This is a placeholder implementation
      throw new Error('Transaction sending not implemented in this demo');
    } catch (error) {
      throw error;
    }
  };

  const clearError = () => {
    dispatch({ type: WALLET_ACTIONS.CLEAR_ERROR });
  };

  const value = {
    state,
    createWallet,
    importWallet,
    unlockWallet,
    lockWallet,
    updateBalance,
    getTransactions,
    sendTransaction,
    clearError,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

// Hook to use wallet context
export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}

export { VLY_NETWORK };