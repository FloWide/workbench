FROM base-workbench:latest
ARG GITHUB_TOKEN=""
ENV DEBIAN_FRONTEND=noninteractive
USER root
WORKDIR /tmp/stuff
COPY . .
RUN curl -O -L https://github.com/FloWide/lsp-ws-proxy/releases/download/v0.0.9/lsp-ws-proxy.tar.gz && \
    tar -xzvf lsp-ws-proxy.tar.gz && \
    mv lsp-ws-proxy /usr/bin/lsp-ws-proxy && \
    chmod +x /usr/bin/lsp-ws-proxy && \
    npm install && \
    npm run build && \ 
    npm pack && \
    npm install -g typescript-language-server typescript && \
    find -name *.tgz | xargs npm install --global  && \
    chown -R runner:runner ${HOME} && \
    mv entrypoint.sh /usr/bin && \
    rm -rf /tmp/stuff

WORKDIR $HOME

ENTRYPOINT [ "entrypoint.sh" ]
CMD [ "workbench-service" ]