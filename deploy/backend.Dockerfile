FROM eclipse-temurin:21-jre
WORKDIR /app
COPY backend.jar /app/backend.jar
VOLUME /data
EXPOSE 3001
ENTRYPOINT ["java", "-Dspring.datasource.url=jdbc:sqlite:/data/tikviews.db", "-jar", "/app/backend.jar"]
