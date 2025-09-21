import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Block from './pages/Block';
import Transaction from './pages/Transaction';
import Address from './pages/Address';
import Blocks from './pages/Blocks';
import Mempool from './pages/Mempool';
import Search from './pages/Search';

function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/blocks" element={<Blocks />} />
          <Route path="/block/:identifier" element={<Block />} />
          <Route path="/transaction/:txid" element={<Transaction />} />
          <Route path="/address/:address" element={<Address />} />
          <Route path="/mempool" element={<Mempool />} />
          <Route path="/search/:query" element={<Search />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

export default App;