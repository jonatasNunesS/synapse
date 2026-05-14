"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export default function LoginPage() {
  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
          <Sparkles className="h-6 w-6 text-primary-foreground" />
        </div>
        <CardTitle className="text-2xl">Synapse</CardTitle>
        <CardDescription>
          Faça login para acessar sua conta
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Email</label>
          <input
            type="email"
            placeholder="seu@email.com"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            disabled
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Senha</label>
          <input
            type="password"
            placeholder="••••••••"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            disabled
          />
        </div>
        <Button className="w-full" disabled>
          Entrar (Disponível no M1)
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Autenticação será implementada no Milestone 1
        </p>
      </CardContent>
    </Card>
  );
}
