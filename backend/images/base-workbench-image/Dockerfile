FROM python:3.14-trixie
ARG GITHUB_TOKEN
RUN groupadd --gid 1000 runner && useradd --uid 1000 --gid runner --shell /bin/bash --create-home runner

ENV HOME=/home/runner
RUN apt-get -y update && \
    apt-get -y upgrade && \
    apt-get -y install curl vim htop jq gosu libgl1 libgomp1 iputils-ping iproute2 && \
    pip install -U pip

WORKDIR /tmp/stuff
COPY . .
RUN pip install -r requirements.txt && \
    poetry build && \
    mv ./config/.[!.]* ${HOME} && \
    chown -R runner:runner ${HOME} && \
    mv watchdog.sh /usr/local/bin/watchdog && \
    rm -rf /tmp/stuff


WORKDIR $HOME

USER runner
ENTRYPOINT [ "/usr/local/bin/run" ]
