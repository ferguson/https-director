import { Command as Commander, Option } from 'commander';
import { toSnake } from 'snake-camel';

export default function parseArgs(argv, options, defaults=null, env_variable_map=null) {
    let commander = new Commander();

    let optionsLines = options.split('\n').filter( line => line.trim().length);
    for (let optionLine of optionsLines) {
        if (!optionLine.includes(' - ')) {
            continue;
        }
        let [ definition, description ] = optionLine.split(' - ');
        // console.log('definition', definition);
        // console.log('description', description);
        definition = definition.trim();
        let option_name = definition.split(' ')[0];
        let option = new Option(definition, description);
        let required = description.includes('<required>') || description.includes('(required)');
        if (required) {
            option.makeOptionMandatory();
        }
        if (defaults) {
            let default_value = defaults[option_name];
            if (default_value) {
                option.default(default_value);
            }
        }
        if (env_variable_map) {
            let env_variable_name = env_variable_map[option_name];
            if (env_variable_name) {
                option.env(env_variable_name);
            }
        }
        commander.addOption(option);
    }

    commander.parse(argv, );
    let opts = commander.opts();
    opts = toSnake(opts);

    return opts;
}
