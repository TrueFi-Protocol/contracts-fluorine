# TODO: Find / build ourselves solc for aarch64
FROM --platform=linux/amd64 ubuntu:20.04

RUN export DEBIAN_FRONTEND=noninteractive && \
    apt update && \
    apt -y upgrade && \
    apt -y install curl git && \
    rm -rf /var/cache/apt/lists

RUN curl -fsSL https://deb.nodesource.com/setup_14.x | bash -

RUN curl -fsSL https://get.docker.com | sh -

RUN export DEBIAN_FRONTEND=noninteractive && \
    apt update && \
    apt -y install nodejs python3.9 python3-pip default-jre && \
    rm -rf /var/cache/apt/lists

RUN npm install -g pnpm@6.20.3

ADD . /root/truefi

WORKDIR /root/truefi/packages/contracts-fluorine/

RUN pnpm install

RUN mkdir build
RUN bash spec/freeze_latest_pip_requirements.sh
RUN pip install --no-cache-dir -r build/requirements-frozen.txt

RUN pnpm build:verify

RUN bash spec/docker/setup.sh

ENTRYPOINT [ "certoraRun" ]
