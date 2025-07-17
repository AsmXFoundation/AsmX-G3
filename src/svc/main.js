const crypto = require('crypto');

class SourceVersionControl {
  constructor() {
    if (SourceVersionControl.instance) {
      return SourceVersionControl.instance;
    }

    SourceVersionControl.instance = this;
  }

  #repository = { HEAD: 0, changes: [], remote_origin: [] };

  repository_add(changes, message) {
    let hash = crypto.createHash('sha1');
    hash.update(`${String(message)}${String(changes)}`);
    hash = hash.digest('hex');
    this.#repository.changes.push({ changes, message, hash });
    return hash;
  }

  repository_push() {
    this.#repository.remote_origin.push(this.#repository.changes.at(-1));
    this.#repository.changes.pop();
    this.#repository.HEAD = this.#repository.remote_origin.length - 1;
  }

  repository_reset(hash) {
    const commit_index = this.#repository.remote_origin.findIndex(commit => commit.hash == hash);

    if (commit_index > -1) {
      const commit = this.#repository.remote_origin[commit_index];
      this.#repository.HEAD = commit_index;
      this.#repository.changes = this.#repository.remote_origin.slice(0, commit_index + 1);
      return commit;
    }
  }
}

module.exports = SourceVersionControl;