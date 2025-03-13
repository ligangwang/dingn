# Use a linux as base image
FROM mcr.microsoft.com/devcontainers/base:jammy

RUN git clone https://github.com/flutter/flutter.git /sdks/flutter

RUN cd /sdks/flutter
RUN git fetch --all

RUN flutter channel stable
RUN flutter upgrade

# Install any additional dependencies required for the project
RUN apt-get update && apt-get install -y \
    lib32stdc++6 \
    libglu1-mesa \
    clang \
    cmake \
    ninja-build \
    pkg-config \
    libgtk-3-dev \
    unzip \
    xz-utils \
    zip

# Install Firebase CLI
RUN curl -sL https://firebase.tools | bash

# Set the working directory
WORKDIR /workspace

# Copy the project files into the container
COPY . /workspace

# Run flutter doctor to ensure everything is set up correctly
RUN flutter doctor
