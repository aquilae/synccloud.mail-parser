FROM quay.io/ndelitski/nodejs
MAINTAINER Nick Delitski

# nodejs runit configuration
RUN     mkdir /etc/service/app
ADD     ./runit /etc/service/app/run
RUN     chmod +x /etc/service/app/run

ADD     ./ /var/app
WORKDIR /var/app
RUN     npm i --production

CMD ["/sbin/my_init"]
