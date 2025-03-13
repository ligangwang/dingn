# Use a base image with Flutter and Firebase pre-installed
FROM cirrusci/flutter:latest

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
