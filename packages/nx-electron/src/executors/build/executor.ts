import { writeFile } from 'fs/promises';
import { join } from 'path';

import { build } from '@cubesoft/nx-shared/src/utils/build/build';
import { resolveDependencies } from '@cubesoft/nx-shared/src/utils/build/dependencies';
import { readJsonFile } from '@cubesoft/nx-shared/src/utils/build/file-utils';
import { getAbsoluteAppRoot, getAbsoluteOutputRoot } from '@cubesoft/nx-shared/src/utils/nx/utils';
import { ExecutorContext, parseTargetString, runExecutor, workspaceRoot } from '@nrwl/devkit';

import { BuildExecutorSchema } from './schema';

export default async function executor(options: BuildExecutorSchema, context: ExecutorContext) {
    const appRoot = getAbsoluteAppRoot(context);
    const outputRoot = getAbsoluteOutputRoot(context);
    const packageJson = await readJsonFile(join(workspaceRoot, 'package.json'));

    const mainFile = join(appRoot, 'src/main.ts');
    const apiFile = join(appRoot, 'src/app/api/preload.ts');

    await build(context, [mainFile, apiFile], outputRoot, join(appRoot, 'tsconfig.app.json'), {}, false, {
        '{{__BUILD_VERSION__}}': packageJson.version
    });
    await resolveDependencies(context.projectName, outputRoot, join(appRoot, 'tsconfig.app.json'), outputRoot);
    await writeFile(join(outputRoot, 'index.js'), `const main = require('./main.js');`);

    const { project, target, configuration } = parseTargetString(
        `${options.frontendProject}:build:${context.configurationName ?? ''}`,
        context.projectGraph
    );
    for await (const output of await runExecutor(
        { project, target, configuration },
        {
            baseHref: './'
        },
        context
    )) {
        if (!output.success) {
            throw new Error('Executor failed.');
        }
    }

    return {
        success: true,
        frontendProject: options.frontendProject
    };
}