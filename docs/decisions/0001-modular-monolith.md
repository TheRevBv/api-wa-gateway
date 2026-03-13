# ADR 0001: Monolito modular

## Estado

Aprobado

## Decisión

Construir `api-wa-gateway` como un único servicio desplegable en Node.js con límites modulares internos:

- `domain`
- `application`
- `infrastructure`
- `interfaces/http`

## Por qué

- El alcance del producto sigue en Fase 1.
- El riesgo principal es el acoplamiento con proveedores, no la distribución entre servicios.
- Un solo servicio mantiene alta la velocidad de entrega y baja la complejidad operativa.

## Consecuencias

- Los contratos entre módulos quedan explícitos mediante puertos y casos de uso.
- Las llamadas entre módulos permanecen dentro del mismo proceso.
- La extracción futura sigue siendo posible, pero solo si aparece una presión real de escalamiento.
