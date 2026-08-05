"use client";
/**
 * Boas-vindas pós-cadastro (?boas_vindas=1): confirma que o Synapse foi
 * configurado com as respostas da Etapa 3 e aponta onde ajustar depois.
 * Dispara uma vez só e limpa a query.
 *
 * Fica isolado num componente porque `useSearchParams()` exige um limite de
 * Suspense — sem isso o "/" não pré-renderiza no build.
 */
import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

export function BoasVindasToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const jaSaudou = useRef(false);

  useEffect(() => {
    if (searchParams.get("boas_vindas") !== "1" || jaSaudou.current) return;
    jaSaudou.current = true;
    toast.success("Pronto! Configuramos o Synapse pro seu negócio.", {
      description: "Você pode ajustar isso em Configurações.",
      duration: 8000,
    });
    router.replace("/");
  }, [searchParams, router]);

  return null;
}
