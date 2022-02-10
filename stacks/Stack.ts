import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as sst from "@serverless-stack/resources";

const productName = "ClearPlatform";

export type ApiEnvironment = { dbName: string };

export default class Stack extends sst.Stack {
  constructor(scope: sst.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const databaseName = `${productName}Db`;
    const vpcName = `${productName}Vpc`;

    const vpc = new ec2.Vpc(this, vpcName);

    const database = new rds.DatabaseInstance(this, "CounterDBCluster", {
      vpc,
      databaseName: databaseName,
      // Set the engine to Postgres
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_13_4,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.BURSTABLE4_GRAVITON,
        ec2.InstanceSize.MICRO
      ),
      multiAz: false,
      maxAllocatedStorage: 200,
      allowMajorVersionUpgrade: true,
      autoMinorVersionUpgrade: true,
      publiclyAccessible: true,
    });

    const api = new sst.Api(this, "Api", {
      routes: {
        "POST /": {
          function: {
            handler: "server/lambda.handler",
            environment: {
              dbName: databaseName,
            },
          },
        },
      },
    });

    database.grantConnect(api.getFunction("POST /")!);

    const site = new sst.NextjsSite(this, "Site", {
      path: "browser",
      environment: {
        REGION: scope.region,
      },
    });

    this.addOutputs({
      BrowserUrl: site.url,
      ApiEndpoint: api.url,
    });
  }
}
