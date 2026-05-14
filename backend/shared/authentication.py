"""
Synapse — Autenticação JWT via Cookie httpOnly
Lê o access_token do cookie em vez do header Authorization.
"""

from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError


class CookieJWTAuthentication(JWTAuthentication):
    """
    Autenticação JWT que lê o token do cookie httpOnly 'access_token'.
    Fallback para o header Authorization: Bearer <token> (para testes/API clients).
    """

    ACCESS_COOKIE = "access_token"

    def authenticate(self, request):
        # 1. Tentar cookie primeiro
        raw_token = request.COOKIES.get(self.ACCESS_COOKIE)

        # 2. Fallback: header Authorization
        if raw_token is None:
            header = self.get_header(request)
            if header is not None:
                raw_token = self.get_raw_token(header)

        if raw_token is None:
            return None

        try:
            validated_token = self.get_validated_token(raw_token)
        except TokenError as e:
            raise InvalidToken(e.args[0])

        return self.get_user(validated_token), validated_token
