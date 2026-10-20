# PlastInnova · Frontend

Angular 22 + Angular Material. Consume la API de `app_plastinnova_backend`.

## Desarrollo

1. Arrancar el backend en el puerto **8080** (IntelliJ o `./mvnw spring-boot:run`).
2. `npm start` → http://localhost:4200

Las llamadas a `/api` pasan por `proxy.conf.json` al backend: mismo origen, sin CORS. En producción el proxy
inverso (nginx/IIS) debe enviar `/api` al backend y servir `dist/app_plastinnova_frontend/browser` para lo demás,
devolviendo `index.html` en las rutas que no sean archivos.

## Cliente de la API (generado)

`src/app/api/` se genera desde el contrato OpenAPI del backend con
[ng-openapi-gen](https://github.com/cyclosproject/ng-openapi-gen). **No editar a mano.**

Cuando cambie la API (con el backend corriendo en 8080):

```bash
npm run api:descargar   # guarda openapi/plastinnova-api.json
npm run api:generar     # regenera src/app/api
```

Uso: `inject(Api).invoke(pedidoObtenerPedido, { id })` devuelve una `Promise` con el DTO.

## Estructura

| Carpeta | Contenido |
|---|---|
| `core/auth` | Sesión (token en localStorage + `/auth/me`), guards por sesión, por permiso y de contraseña temporal |
| `core/http` | Interceptores: token, cierre de sesión en 401, avisos de error (`ProblemDetail` del backend) |
| `core/navegacion` | Menú por permiso/rol, pantalla de inicio por rol, títulos de pestaña |
| `core/ui` | Avisos, confirmación, chip de estado y fechas (`utc`/`dia`: el backend envía UTC sin zona; se muestran en hora de la planta, UTC-5) |
| `layout` | Marco de las pantallas: barra superior para tablet (operador) o menú lateral (demás roles) |
| `features/operador` | Tablet: cola de trabajo por etapa, búsqueda por pedido, reportar avance e historial de la línea |
| `features/pedidos` | Coordinación: listado con filtros en la URL, detalle con estado, fecha de entrega, líneas e historial |
| `features/configuracion` | Catálogos de estados y transiciones; bitácora y ejecución de la sincronización |
| `features/usuarios` | Administrador: usuarios, roles, activación y contraseñas temporales (se muestran una sola vez) |
| `features/gerencia` | Tablero: estado actual de la planta e indicadores de un periodo (periodo y opciones en la URL) |
| `features` | Demás pantallas (login, cuenta, errores) |

Errores de la API: sin hacer nada, el interceptor los muestra en un aviso. Si la pantalla los muestra por su
cuenta (ej. un formulario), enviar la petición con `new HttpContext().set(MANEJA_ERRORES, true)`.

## Pruebas

```bash
npm test -- --watch=false   # Vitest
npm run build
```

## Tema

Paleta provisional en `src/styles.scss`. Con el manual de marca se cambian `primary`/`tertiary` allí.
Fuentes e íconos autohospedados (`@fontsource/roboto`, `material-symbols`): no dependen de internet.
