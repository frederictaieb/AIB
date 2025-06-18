"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [result, setResult] = useState<{ username: string; wallet: any } | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async () => {
    setLoading(true);
    setResult(null);
    try {
      console.log(`${process.env.NEXT_PUBLIC_FASTAPI_ADDR}/api/create_user/${encodeURIComponent(username)}`);
      const res = await fetch(`${process.env.NEXT_PUBLIC_FASTAPI_ADDR}/api/create_user/${encodeURIComponent(username)}`);
      if (!res.ok) throw new Error("Erreur lors de la création de l'utilisateur");
      const data = await res.json();
      console.log(data);
      if (data.wallet_address) {
        localStorage.setItem('wallet_address', data.wallet_address);
      }
      setResult(data);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (result) {
      router.push("/client");
    }
  }, [result, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 space-y-8">
      <div className="flex flex-col items-center space-y-4">
        <input
          type="text"
          placeholder="Enter username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          className="px-4 py-2 border rounded-lg text-lg"
        />
        <button
          onClick={handleRegister}
          disabled={loading || !username}
          className="text-2xl px-8 py-4 rounded-xl bg-blue-600 text-white font-bold shadow hover:bg-blue-700 transition-all disabled:opacity-50"
        >
          {loading ? "Loading..." : "Register"}
        </button>
      </div>
    </div>
  );
}
