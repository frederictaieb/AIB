"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import Link from "next/link";   
import Image from "next/image";

export default function RegisterPage() {
  return (

    <div className="flex flex-col items-center justify-center h-screen space-y-8">
      <h1><div className="text-8xl font-bold text-gray-800 pt-12">AIcebreaker</div></h1>
      <h1><div className="text-4xl font-bold text-gray-800 pt-4"><Image src="/xrp-logo.svg" alt="AIcebreaker" width={100} height={100} /></div></h1>

      <div className="flex flex-col items-center justify-center h-screen space-y-20">
        <QRCodeSVG value={`${process.env.NEXT_PUBLIC_FRONTEND_ADDR}/register`} size={256} />
        <div className="text-6xl font-bold text-gray-800 pb-30">Scan the QR code to <Link href={`${process.env.NEXT_PUBLIC_FRONTEND_ADDR}/register`} className="text-blue-500">
        <div className="underline text-center">register</div></Link></div>
      </div>
    </div>
  );
}
