export function assembleURL(path, query=null, base=null) {
    // let url = new URL(path, window.location.href);
    let url = new URL(path, base);
    if (query) {
        url.search = new URLSearchParams(query).toString();
    }
    //console.log('import.meta.env.DEV', import.meta.env.DEV);
    // if (import.meta.env.DEV) {
    //     // console.log('dev mode, fetching from 10.8.0.1:1967');
    //     // url.host = '10.8.0.1:1967';
    // }
    return url;
}


export async function fetch200(...args) {
    let response = await fetch(...args);
    if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
    }
    return response;
}


export async function fetchPostJSON(path, data=null, query=null, base=null) {
    let opts = {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
    };
    if (data) {
        opts.body = JSON.stringify(data);
    }
    let url = assembleURL(path, query, base);
    //let url = path;  // rover commeted out the above line and used this instead for some reason FIXME
    let response = await fetch200(url, opts);
    return response.json();
}


export async function fetchGetJSON(path, query=null, base=null) {
    let opts = {
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
    };
    let url = assembleURL(path, query, base);
    let response = await fetch200(url, opts);
    return response.json();
}
