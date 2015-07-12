#!/bin/sh
set -e

repo=quay.io/ndelitski
image=synccloud-mail-parser
container=synccloud-mail-parser
git_rev=$(git rev-parse --abbrev-ref HEAD)
version=latest
eb_env=sc-mail-parse-prod
eb_app=synccloud.mail-parser
eb_sources_bucket=synccloud-deployments

#
# Output usage information.
#

usage() {
  cat <<-EOF
  Usage: deploy [command]
  Commands:
    remote               deploy app to remote host
    local                deploy app locally using docker
    publish_container    publosh docker container to repository
EOF
}

#
# Build image
#

build() {
  docker build --rm -t $image ./
}

#
# Deploy image to local Docker
#

deploy_local() {
    build
    docker kill $container && docker rm $container || echo ''
    docker run \
      -d \
      -e CONFIGURATION=http://synccloud-config.elasticbeanstalk.com/config/mail-parser/master@raven \
      -e DEBUG=synccloud* \
      --name $container $image
}

#
# Uploads sources to s3 bucket and trigger Beanstalk environment to update
#

update_env() {
  test -n "$1" && local version=$1
  test -n "$2" && local eb_env=$2
  echo "Updating ${eb_env} with version $version"
  local zipFile=${eb_app}_${version}.zip
  zip -qr9 "$zipFile" Dockerrun.aws.json
  aws s3 cp "./$zipFile" s3://$eb_sources_bucket/${eb_app}/${version}.zip
  rm "./$zipFile"

  aws elasticbeanstalk delete-application-version \
      --application-name "$eb_app" \
      --version-label "$version" \
      --delete-source-bundle
  aws elasticbeanstalk create-application-version \
      --application-name "$eb_app" \
      --version-label "$version" \
      --source-bundle S3Bucket="$eb_sources_bucket",S3Key="${eb_app}/${version}.zip"
  aws elasticbeanstalk update-environment \
      --environment-name "$eb_env" \
      --version-label "$version"
}

#
# Deploy app to amazon
#

deploy_remote() {
    test -n "$1" && local version=$1
    test -n "$2" && local eb_env=$2
    publish_container $version
    update_env $version $eb_env
}

#
# Publish Docker container to repository
#

publish_container() {
  test -n "$1" && local version=$1
  build
  docker tag -f $image $repo/$image:$version
  docker push $repo/$image:$version
}

case $1 in
  -h|--help) usage; exit;;
  remote) deploy_remote "${@:2}"; exit;;
  local) deploy_local; exit;;
  publish_container) publish_container "${@:2}"; exit;;
  *) usage; exit 1;;
esac
