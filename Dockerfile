FROM nginx:stable-alpine

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY web/ /opt/ServerStatus/web/

EXPOSE 80
