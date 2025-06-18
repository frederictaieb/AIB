export const speak = async (
    text: string,
    lang: string = "fr",
    tts_type: string = "x3",
    audioRef?: HTMLAudioElement
  ) => {
    try {
        let address = ""

        if (tts_type === "google") {
            address = `${process.env.NEXT_PUBLIC_FASTAPI_ADDR}/api/tts_google/`
            console.log("TTS Google")
        }
        else {
            address = `${process.env.NEXT_PUBLIC_FASTAPI_ADDR}/api/tts_x3/`
            console.log("TTS X3")
        }
      const res = await fetch(address, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang }),
      });
  
      if (!res.ok) {
        const error = await res.text();
        console.error("Erreur lors de la requête TTS :", res.status, error);
        return;
      }
  
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
  
      // Si un élément audio est fourni
      if (audioRef) {
        audioRef.src = url;
        await audioRef.play();
      } else {
        // Sinon créer un élément audio temporaire
        const tempAudio = new Audio(url);
        await tempAudio.play();
      }
    } catch (err) {
      console.error("Erreur réseau :", err);
    }
  };
  