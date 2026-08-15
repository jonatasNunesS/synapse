"""
Synapse — Throttles customizados.

O grosso do rate limiting usa o ScopedRateThrottle do DRF (limite por IP,
declarado via `throttle_scope` na view). Aqui ficam os casos que precisam de
uma chave diferente de IP.
"""
import hashlib

from rest_framework.throttling import ScopedRateThrottle, SimpleRateThrottle


class ScopedIPThrottle(ScopedRateThrottle):
    """
    ScopedRateThrottle que conta SEMPRE por IP, mesmo com usuário autenticado.

    O ScopedRateThrottle do DRF troca a chave para o id do usuário assim que a
    requisição está autenticada. Nos fluxos de conta isso abre um bypass: o
    registro devolve os cookies do usuário recém-criado, então a requisição
    seguinte chega autenticada como OUTRA pessoa e começa um contador zerado —
    um script que reaproveite a sessão cadastra à vontade.

    Criar conta e recuperar senha são ações anônimas por natureza; estar
    autenticado ali é acidente, não identidade. Contar por IP é o que fecha
    o bypass.
    """

    def get_cache_key(self, request, view):
        return self.cache_format % {
            "scope": self.scope,
            "ident": self.get_ident(request),
        }


class RecuperarSenhaEmailThrottle(SimpleRateThrottle):
    """
    Limita a recuperação de senha por E-MAIL, além do limite por IP.

    Só o limite por IP não protege a caixa da vítima: um atacante distribuído
    (ou atrás de IPs rotativos) continua conseguindo disparar dezenas de
    e-mails para o mesmo endereço. Limitar por e-mail fecha esse ângulo.

    ENUMERAÇÃO DE USUÁRIO: a contagem é feita sobre o e-mail SUBMETIDO, sem
    consultar se ele existe. Endereço cadastrado e não cadastrado são contados
    e bloqueados exatamente igual, então o throttle não vira um oráculo de
    "este e-mail existe" — que é justamente o que a resposta silenciosa da
    view evita.

    A chave guardada é um hash do e-mail: o cache não precisa (nem deve)
    guardar o endereço em claro.
    """

    scope = "recuperar_senha_email"

    def get_cache_key(self, request, view):
        try:
            email = (request.data.get("email") or "").strip().lower()
        except Exception:
            # Corpo malformado: o limite por IP ainda vale.
            return None
        if not email:
            return None
        return self.cache_format % {
            "scope": self.scope,
            "ident": hashlib.sha256(email.encode("utf-8")).hexdigest(),
        }
