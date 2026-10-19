# ---------- 1. build ----------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ProductApi.csproj .
RUN dotnet restore
COPY . .
RUN dotnet publish ProductApi.csproj -c Release -o /app/publish --no-restore

# ---------- 2. run ----------
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# ASPNETCORE_FORWARDEDHEADERS_ENABLED: trust the proxy in front of us (it is on a private Docker network
# that nothing from the internet can reach directly), so visitors' real addresses reach the rate limits.
ENV ASPNETCORE_URLS=http://+:8080 \
    ASPNETCORE_ENVIRONMENT=Production \
    ASPNETCORE_FORWARDEDHEADERS_ENABLED=true \
    DOTNET_EnableDiagnostics=0

COPY --from=build /app/publish .

# Uploaded product images live here. It is a volume, so they survive updates of the container.
RUN mkdir -p /app/uploads/products && chown -R $APP_UID /app/uploads

# Never run as root inside the container
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "ProductApi.dll"]
