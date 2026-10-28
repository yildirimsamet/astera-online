# Production PostgreSQL plus pgBackRest for continuous, encrypted off-site backup
# (docs/deployment.md, "Continuous backup").
#
# Pinned to the exact build production already ran before archiving: a floating tag
# would turn the archive restart into an unplanned minor upgrade. Move it on purpose.
FROM postgres:16-alpine@sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777
RUN apk add --no-cache pgbackrest
