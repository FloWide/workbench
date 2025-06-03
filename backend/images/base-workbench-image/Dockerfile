FROM nikolaik/python-nodejs:python3.10-nodejs20
ARG GITHUB_TOKEN
RUN userdel --remove pn && \
    groupadd --gid 1000 runner && useradd --uid 1000 --gid runner --shell /bin/bash --create-home runner

ENV HOME=/home/runner
RUN apt-get -y update && \
    apt-get -y upgrade && \
    apt-get -y install curl vim tldr htop jq gosu libgl1 libgomp1 iputils-ping iproute2 && \
    pip install -U pip

WORKDIR /tmp/stuff
COPY . .
RUN ./get_extra_packages.sh && \
    ./install_potree_converter.sh && \
    pip install -r requirements.txt && \
    find ./wheel_files -name *.whl | xargs --no-run-if-empty pip install && \
    poetry build && \
    find ./dist -name *.whl | xargs pip install && \
    npm install http-server typescript ts-node -g && \
    mv ./config/.[!.]* ${HOME} && \
    chown -R runner:runner ${HOME} && \
    mv watchdog.sh /usr/local/bin/watchdog && \
    rm -rf /tmp/stuff


WORKDIR $HOME

USER runner
ENTRYPOINT [ "/usr/local/bin/run" ]
