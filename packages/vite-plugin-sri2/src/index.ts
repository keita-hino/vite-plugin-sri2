import { Plugin } from 'vite';
import * as cheerio from 'cheerio';
import { calculateSRI } from './sri';
import { pluginName, type StandardHashFunctionName } from './grobals';
import { isThirdPartyAsset, fetchResource, getSourceFromBundle } from './resourceHelpers';
import { validateOptions } from './validateOptions';

export interface Options {
  hashFunctionName: StandardHashFunctionName;
}

const DEFAULT_OPTIONS: Options = {
  hashFunctionName: 'sha384'
};

export function sri(inlineOptions?: Partial<Options>): Plugin {
  const options = {
    ...DEFAULT_OPTIONS,
    ...inlineOptions
  };
  return {
    name: pluginName,
    enforce: 'post',
    transformIndexHtml: {
      enforce: 'post',
      async transform(html, context) {
        const errorMessages = validateOptions(options);
        if (errorMessages.length) {
          // TODO: add custom error
          const errorMessage = errorMessages
            .map((message) => `[${pluginName}] ${message}`)
            .join(', ');
          throw new Error(errorMessage);
        }
        const $ = cheerio.load(html);
        const scriptElements = $('script[src]');
        const stylesheetElements = $('link[rel="stylesheet"][href]');

        const elements = [...scriptElements, ...stylesheetElements];

        if (context.bundle) {
          for (const element of elements) {
            const src = ($(element).attr('src') || $(element).attr('href')) as string;

            const source = isThirdPartyAsset(src)
              ? await fetchResource(src)
              : getSourceFromBundle(context.bundle, src);

            const sri = calculateSRI(options.hashFunctionName, source);
            $(element).attr('integrity', sri);
          }
        }

        return $.html();
      }
    }
  };
}
