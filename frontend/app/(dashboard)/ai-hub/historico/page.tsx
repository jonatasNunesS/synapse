"use client";

import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HistoricoConteudos } from "@/components/ai_hub/HistoricoConteudos";

export default function AIHubHistoricoPage() {
  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center gap-4">
        <Link href="/ai-hub">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-purple-500" />
            Histórico de Conteúdos
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Todos os conteúdos gerados pela IA para o seu negócio
          </p>
        </div>
      </div>

      {/* Histórico com filtros */}
      <HistoricoConteudos />
    </div>
  );
}
