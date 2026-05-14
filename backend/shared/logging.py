"""
Synapse - Utilitários de Logging
Funções auxiliares para logging estruturado.
"""

import logging
from functools import wraps
from typing import Any


def get_module_logger(module_name: str) -> logging.Logger:
    """
    Retorna um logger configurado para o módulo especificado.
    Uso: logger = get_module_logger("financeiro")
    """
    return logging.getLogger(f"synapse.{module_name}")


def log_service_call(logger: logging.Logger):
    """
    Decorator que loga chamadas a métodos de Service.
    Registra entrada, saída e exceções.
    """

    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            func_name = f"{func.__module__}.{func.__qualname__}"
            logger.debug(
                f"Service call started: {func_name}",
                extra={"function": func_name, "args_count": len(args)},
            )
            try:
                result = func(*args, **kwargs)
                logger.debug(
                    f"Service call completed: {func_name}",
                    extra={"function": func_name, "success": True},
                )
                return result
            except Exception as e:
                logger.error(
                    f"Service call failed: {func_name}",
                    extra={
                        "function": func_name,
                        "error_type": type(e).__name__,
                        "error_message": str(e),
                    },
                    exc_info=True,
                )
                raise

        return wrapper

    return decorator
